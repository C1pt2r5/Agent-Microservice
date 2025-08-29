# Configuration Deployment Script for Windows
# This script deploys configuration and secrets to Kubernetes

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [string]$ConfigPath = "./config",
    
    [Parameter(Mandatory=$false)]
    [string]$KubeContext = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory=$false)]
    [switch]$ValidateOnly,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [string]$EncryptionKey = ""
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-Prerequisites {
    Write-ColorOutput "Checking prerequisites..." $Blue
    
    # Check if kubectl is installed
    try {
        kubectl version --client --short | Out-Null
        Write-ColorOutput "✓ kubectl is installed" $Green
    }
    catch {
        Write-ColorOutput "✗ kubectl is not installed or not in PATH" $Red
        exit 1
    }
    
    # Check if Node.js is installed (for config validation)
    try {
        node --version | Out-Null
        Write-ColorOutput "✓ Node.js is installed" $Green
    }
    catch {
        Write-ColorOutput "✗ Node.js is not installed or not in PATH" $Red
        exit 1
    }
    
    # Check if configuration files exist
    $configFile = Join-Path $ConfigPath "environments" "$Environment.yaml"
    if (-not (Test-Path $configFile)) {
        Write-ColorOutput "✗ Configuration file not found: $configFile" $Red
        exit 1
    }
    Write-ColorOutput "✓ Configuration file found" $Green
    
    # Check if secrets file exists
    $secretsFile = Join-Path $ConfigPath "secrets" "$Environment.yaml"
    if (-not (Test-Path $secretsFile)) {
        Write-ColorOutput "⚠ Secrets file not found: $secretsFile" $Yellow
    }
    else {
        Write-ColorOutput "✓ Secrets file found" $Green
    }
}

function Set-KubernetesContext {
    if ($KubeContext) {
        Write-ColorOutput "Setting Kubernetes context to: $KubeContext" $Blue
        kubectl config use-context $KubeContext
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "✗ Failed to set Kubernetes context" $Red
            exit 1
        }
    }
    
    # Get current context
    $currentContext = kubectl config current-context
    Write-ColorOutput "Current Kubernetes context: $currentContext" $Blue
}

function Invoke-ConfigValidation {
    Write-ColorOutput "Validating configuration..." $Blue
    
    # Run TypeScript validation
    $validationScript = Join-Path $PSScriptRoot "validate-config.ts"
    $result = node -r ts-node/register $validationScript --environment $Environment --config-path $ConfigPath
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "✗ Configuration validation failed" $Red
        exit 1
    }
    
    Write-ColorOutput "✓ Configuration validation passed" $Green
}

function Deploy-Namespace {
    param([string]$NamespaceName)
    
    Write-ColorOutput "Creating namespace: $NamespaceName" $Blue
    
    $namespaceYaml = @"
apiVersion: v1
kind: Namespace
metadata:
  name: $NamespaceName
  labels:
    environment: $Environment
    managed-by: config-deploy-script
"@
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would create namespace:" $Yellow
        Write-Host $namespaceYaml
        return
    }
    
    $namespaceYaml | kubectl apply -f -
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Namespace created/updated successfully" $Green
    }
    else {
        Write-ColorOutput "✗ Failed to create namespace" $Red
        exit 1
    }
}

function Deploy-ConfigMaps {
    param([string]$NamespaceName)
    
    Write-ColorOutput "Deploying ConfigMaps..." $Blue
    
    # Generate ConfigMaps for each service
    $services = @("chatbot-agent", "fraud-detection-agent", "recommendation-agent", "mcp-gateway", "a2a-hub", "adk")
    
    foreach ($service in $services) {
        Write-ColorOutput "Generating ConfigMap for: $service" $Blue
        
        # Run config manager to generate ConfigMap
        $configMapScript = Join-Path $PSScriptRoot "generate-configmap.ts"
        $configMapYaml = node -r ts-node/register $configMapScript --environment $Environment --service $service --config-path $ConfigPath
        
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "✗ Failed to generate ConfigMap for $service" $Red
            continue
        }
        
        if ($DryRun) {
            Write-ColorOutput "DRY RUN: Would apply ConfigMap for $service:" $Yellow
            Write-Host $configMapYaml
            continue
        }
        
        # Apply ConfigMap
        $configMapYaml | kubectl apply -n $NamespaceName -f -
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ ConfigMap for $service deployed successfully" $Green
        }
        else {
            Write-ColorOutput "✗ Failed to deploy ConfigMap for $service" $Red
        }
    }
}

function Deploy-Secrets {
    param([string]$NamespaceName)
    
    Write-ColorOutput "Deploying Secrets..." $Blue
    
    $secretsFile = Join-Path $ConfigPath "secrets" "$Environment.yaml"
    if (-not (Test-Path $secretsFile)) {
        Write-ColorOutput "⚠ No secrets file found, skipping secret deployment" $Yellow
        return
    }
    
    # Generate Secrets
    $secretsScript = Join-Path $PSScriptRoot "generate-secrets.ts"
    $secretsYaml = node -r ts-node/register $secretsScript --environment $Environment --config-path $ConfigPath --encryption-key $EncryptionKey
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "✗ Failed to generate Secrets" $Red
        return
    }
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would apply Secrets:" $Yellow
        # Don't show actual secret values in dry run
        Write-Host "Secrets would be deployed (values hidden for security)"
        return
    }
    
    # Apply Secrets
    $secretsYaml | kubectl apply -n $NamespaceName -f -
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Secrets deployed successfully" $Green
    }
    else {
        Write-ColorOutput "✗ Failed to deploy Secrets" $Red
    }
}

function Update-Configuration {
    param([string]$NamespaceName)
    
    Write-ColorOutput "Updating existing configuration..." $Blue
    
    # Check if resources exist
    $existingConfigMaps = kubectl get configmaps -n $NamespaceName -o name 2>$null
    $existingSecrets = kubectl get secrets -n $NamespaceName -o name 2>$null
    
    if ($existingConfigMaps) {
        Write-ColorOutput "Found existing ConfigMaps, updating..." $Blue
        Deploy-ConfigMaps $NamespaceName
    }
    
    if ($existingSecrets) {
        Write-ColorOutput "Found existing Secrets, updating..." $Blue
        Deploy-Secrets $NamespaceName
    }
    
    # Restart deployments to pick up new configuration
    Write-ColorOutput "Restarting deployments to pick up new configuration..." $Blue
    $deployments = kubectl get deployments -n $NamespaceName -o name 2>$null
    
    if ($deployments) {
        foreach ($deployment in $deployments) {
            if (-not $DryRun) {
                kubectl rollout restart $deployment -n $NamespaceName
                Write-ColorOutput "✓ Restarted $deployment" $Green
            }
            else {
                Write-ColorOutput "DRY RUN: Would restart $deployment" $Yellow
            }
        }
    }
}

function Verify-Deployment {
    param([string]$NamespaceName)
    
    Write-ColorOutput "Verifying deployment..." $Blue
    
    # Check ConfigMaps
    $configMaps = kubectl get configmaps -n $NamespaceName --no-headers 2>$null
    if ($configMaps) {
        $configMapCount = ($configMaps | Measure-Object).Count
        Write-ColorOutput "✓ Found $configMapCount ConfigMaps" $Green
    }
    
    # Check Secrets
    $secrets = kubectl get secrets -n $NamespaceName --no-headers 2>$null
    if ($secrets) {
        $secretCount = ($secrets | Measure-Object).Count
        Write-ColorOutput "✓ Found $secretCount Secrets" $Green
    }
    
    # Check if pods are running
    $pods = kubectl get pods -n $NamespaceName --field-selector=status.phase=Running --no-headers 2>$null
    if ($pods) {
        $runningPodCount = ($pods | Measure-Object).Count
        Write-ColorOutput "✓ Found $runningPodCount running pods" $Green
    }
    else {
        Write-ColorOutput "⚠ No running pods found" $Yellow
    }
}

function Show-Summary {
    param([string]$NamespaceName)
    
    Write-ColorOutput "`n=== Deployment Summary ===" $Blue
    Write-ColorOutput "Environment: $Environment" $Blue
    Write-ColorOutput "Namespace: $NamespaceName" $Blue
    Write-ColorOutput "Dry Run: $DryRun" $Blue
    
    if (-not $DryRun) {
        Write-ColorOutput "`nDeployed Resources:" $Blue
        kubectl get all -n $NamespaceName
    }
}

# Main execution
try {
    Write-ColorOutput "Starting configuration deployment for environment: $Environment" $Blue
    Write-ColorOutput "=================================================" $Blue
    
    # Check prerequisites
    Test-Prerequisites
    
    # Set Kubernetes context
    Set-KubernetesContext
    
    # Validate configuration
    if ($ValidateOnly) {
        Invoke-ConfigValidation
        Write-ColorOutput "✓ Validation completed successfully" $Green
        exit 0
    }
    
    # Load configuration to get namespace
    $configFile = Join-Path $ConfigPath "environments" "$Environment.yaml"
    $config = Get-Content $configFile | ConvertFrom-Yaml
    $namespaceName = $config.global.namespace
    
    Write-ColorOutput "Target namespace: $namespaceName" $Blue
    
    # Validate configuration
    Invoke-ConfigValidation
    
    # Deploy namespace
    Deploy-Namespace $namespaceName
    
    # Deploy ConfigMaps
    Deploy-ConfigMaps $namespaceName
    
    # Deploy Secrets
    Deploy-Secrets $namespaceName
    
    # Update existing configuration if not a fresh deployment
    if (-not $Force) {
        Update-Configuration $namespaceName
    }
    
    # Verify deployment
    if (-not $DryRun) {
        Verify-Deployment $namespaceName
    }
    
    # Show summary
    Show-Summary $namespaceName
    
    Write-ColorOutput "`n✓ Configuration deployment completed successfully!" $Green
}
catch {
    Write-ColorOutput "✗ Configuration deployment failed: $($_.Exception.Message)" $Red
    exit 1
}

# Helper function to convert YAML (requires PowerShell-Yaml module)
function ConvertFrom-Yaml {
    param([Parameter(ValueFromPipeline)]$InputObject)
    
    # Simple YAML parsing for namespace extraction
    # In production, use proper YAML parsing library
    $lines = $InputObject -split "`n"
    foreach ($line in $lines) {
        if ($line -match "^\s*namespace:\s*(.+)$") {
            return @{ global = @{ namespace = $matches[1].Trim() } }
        }
    }
    return @{ global = @{ namespace = "default" } }
}