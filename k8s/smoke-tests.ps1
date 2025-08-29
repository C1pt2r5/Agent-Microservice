# Kubernetes Deployment Smoke Tests - PowerShell Version
# This script performs basic smoke tests to validate deployments

param(
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Kubernetes Deployment Smoke Tests..." -ForegroundColor Cyan

# Function to print colored output
function Write-Status {
    param(
        [string]$Status,
        [string]$Message
    )
    
    switch ($Status) {
        "SUCCESS" { Write-Host "✅ $Message" -ForegroundColor Green }
        "ERROR" { Write-Host "❌ $Message" -ForegroundColor Red }
        "WARNING" { Write-Host "⚠️  $Message" -ForegroundColor Yellow }
        "INFO" { Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
    }
}

# Function to check if kubectl is available
function Test-Kubectl {
    try {
        $null = Get-Command kubectl -ErrorAction Stop
        Write-Status "SUCCESS" "kubectl is available"
        return $true
    }
    catch {
        Write-Status "ERROR" "kubectl is not installed or not in PATH"
        return $false
    }
}

# Function to check cluster connectivity
function Test-ClusterConnection {
    try {
        $null = kubectl cluster-info 2>$null
        Write-Status "SUCCESS" "Connected to Kubernetes cluster"
        return $true
    }
    catch {
        Write-Status "ERROR" "Cannot connect to Kubernetes cluster"
        return $false
    }
}

# Function to check if namespaces exist
function Test-Namespaces {
    $namespaces = @("ai-agents", "integration", "infrastructure")
    $allExist = $true
    
    foreach ($namespace in $namespaces) {
        try {
            $null = kubectl get namespace $namespace 2>$null
            Write-Status "SUCCESS" "Namespace '$namespace' exists"
        }
        catch {
            Write-Status "ERROR" "Namespace '$namespace' does not exist"
            $allExist = $false
        }
    }
    
    return $allExist
}

# Function to validate deployments
function Test-Deployments {
    $deployments = @(
        @{Namespace="ai-agents"; Name="chatbot-agent"},
        @{Namespace="ai-agents"; Name="fraud-detection-agent"},
        @{Namespace="ai-agents"; Name="recommendation-agent"},
        @{Namespace="integration"; Name="mcp-gateway"},
        @{Namespace="integration"; Name="a2a-hub"},
        @{Namespace="integration"; Name="redis"},
        @{Namespace="infrastructure"; Name="adk-service"}
    )
    
    foreach ($deployment in $deployments) {
        $namespace = $deployment.Namespace
        $name = $deployment.Name
        
        try {
            $null = kubectl get deployment $name -n $namespace 2>$null
            Write-Status "SUCCESS" "Deployment '$name' exists in namespace '$namespace'"
            
            # Check deployment status
            $readyReplicas = kubectl get deployment $name -n $namespace -o jsonpath='{.status.readyReplicas}' 2>$null
            $desiredReplicas = kubectl get deployment $name -n $namespace -o jsonpath='{.spec.replicas}' 2>$null
            
            if ($readyReplicas -eq $desiredReplicas -and $readyReplicas -ne "0" -and $readyReplicas -ne $null) {
                Write-Status "SUCCESS" "Deployment '$name' is ready ($readyReplicas/$desiredReplicas replicas)"
            }
            else {
                Write-Status "WARNING" "Deployment '$name' is not fully ready ($readyReplicas/$desiredReplicas replicas)"
            }
        }
        catch {
            Write-Status "ERROR" "Deployment '$name' does not exist in namespace '$namespace'"
        }
    }
}

# Function to validate services
function Test-Services {
    $services = @(
        @{Namespace="ai-agents"; Name="chatbot-agent"},
        @{Namespace="ai-agents"; Name="fraud-detection-agent"},
        @{Namespace="ai-agents"; Name="recommendation-agent"},
        @{Namespace="integration"; Name="mcp-gateway"},
        @{Namespace="integration"; Name="a2a-hub"},
        @{Namespace="integration"; Name="redis"},
        @{Namespace="infrastructure"; Name="adk-service"}
    )
    
    foreach ($service in $services) {
        $namespace = $service.Namespace
        $name = $service.Name
        
        try {
            $null = kubectl get service $name -n $namespace 2>$null
            Write-Status "SUCCESS" "Service '$name' exists in namespace '$namespace'"
            
            # Check if service has endpoints
            $endpoints = kubectl get endpoints $name -n $namespace -o jsonpath='{.subsets[*].addresses[*].ip}' 2>$null
            if ($endpoints -and $endpoints.Trim() -ne "") {
                Write-Status "SUCCESS" "Service '$name' has active endpoints"
            }
            else {
                Write-Status "WARNING" "Service '$name' has no active endpoints"
            }
        }
        catch {
            Write-Status "ERROR" "Service '$name' does not exist in namespace '$namespace'"
        }
    }
}

# Function to validate PVCs
function Test-PVCs {
    $pvcs = @(
        @{Namespace="ai-agents"; Name="chatbot-agent-pvc"},
        @{Namespace="ai-agents"; Name="fraud-detection-agent-pvc"},
        @{Namespace="ai-agents"; Name="fraud-detection-models-pvc"},
        @{Namespace="ai-agents"; Name="recommendation-agent-pvc"},
        @{Namespace="integration"; Name="redis-pvc"},
        @{Namespace="infrastructure"; Name="adk-templates-pvc"}
    )
    
    foreach ($pvc in $pvcs) {
        $namespace = $pvc.Namespace
        $name = $pvc.Name
        
        try {
            $status = kubectl get pvc $name -n $namespace -o jsonpath='{.status.phase}' 2>$null
            if ($status -eq "Bound") {
                Write-Status "SUCCESS" "PVC '$name' is bound in namespace '$namespace'"
            }
            else {
                Write-Status "WARNING" "PVC '$name' status is '$status' in namespace '$namespace'"
            }
        }
        catch {
            Write-Status "ERROR" "PVC '$name' does not exist in namespace '$namespace'"
        }
    }
}

# Function to validate HPAs
function Test-HPAs {
    $hpas = @(
        @{Namespace="ai-agents"; Name="chatbot-agent-hpa"},
        @{Namespace="ai-agents"; Name="fraud-detection-agent-hpa"},
        @{Namespace="ai-agents"; Name="recommendation-agent-hpa"},
        @{Namespace="integration"; Name="mcp-gateway-hpa"},
        @{Namespace="integration"; Name="a2a-hub-hpa"}
    )
    
    foreach ($hpa in $hpas) {
        $namespace = $hpa.Namespace
        $name = $hpa.Name
        
        try {
            $null = kubectl get hpa $name -n $namespace 2>$null
            Write-Status "SUCCESS" "HPA '$name' exists in namespace '$namespace'"
            
            # Check HPA status
            $currentReplicas = kubectl get hpa $name -n $namespace -o jsonpath='{.status.currentReplicas}' 2>$null
            $desiredReplicas = kubectl get hpa $name -n $namespace -o jsonpath='{.status.desiredReplicas}' 2>$null
            
            if ($currentReplicas -and $desiredReplicas -and $currentReplicas -ne "0" -and $desiredReplicas -ne "0") {
                Write-Status "SUCCESS" "HPA '$name' is active ($currentReplicas/$desiredReplicas replicas)"
            }
            else {
                Write-Status "WARNING" "HPA '$name' metrics may not be available yet"
            }
        }
        catch {
            Write-Status "ERROR" "HPA '$name' does not exist in namespace '$namespace'"
        }
    }
}

# Function to check pod health
function Test-PodHealth {
    $namespaces = @("ai-agents", "integration", "infrastructure")
    
    foreach ($namespace in $namespaces) {
        Write-Status "INFO" "Checking pod health in namespace '$namespace'"
        
        try {
            $pods = kubectl get pods -n $namespace --no-headers 2>$null
            if (-not $pods) {
                Write-Status "WARNING" "No pods found in namespace '$namespace'"
                continue
            }
            
            $podLines = $pods -split "`n" | Where-Object { $_.Trim() -ne "" }
            foreach ($podLine in $podLines) {
                $parts = $podLine -split '\s+' | Where-Object { $_ -ne "" }
                if ($parts.Count -ge 3) {
                    $podName = $parts[0]
                    $ready = $parts[1]
                    $status = $parts[2]
                    
                    if ($status -eq "Running" -and $ready -match '^\d+/\d+$' -and $ready -notmatch '^0/') {
                        Write-Status "SUCCESS" "Pod '$podName' is healthy ($ready, $status)"
                    }
                    else {
                        Write-Status "WARNING" "Pod '$podName' status: $ready, $status"
                    }
                }
            }
        }
        catch {
            Write-Status "WARNING" "Could not retrieve pods for namespace '$namespace'"
        }
    }
}

# Function to test basic connectivity
function Test-Connectivity {
    Write-Status "INFO" "Testing basic service connectivity..."
    
    $services = @("mcp-gateway", "a2a-hub", "redis")
    
    foreach ($service in $services) {
        try {
            $serviceIP = kubectl get service $service -n integration -o jsonpath='{.spec.clusterIP}' 2>$null
            if ($serviceIP -and $serviceIP -ne "None" -and $serviceIP.Trim() -ne "") {
                Write-Status "SUCCESS" "Service '$service' has cluster IP: $serviceIP"
            }
            else {
                Write-Status "WARNING" "Service '$service' has no cluster IP assigned"
            }
        }
        catch {
            Write-Status "WARNING" "Could not get cluster IP for service '$service'"
        }
    }
}

# Main execution
function Main {
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "🧪 Kubernetes Deployment Smoke Tests" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    
    if (-not (Test-Kubectl)) {
        exit 1
    }
    
    if (-not (Test-ClusterConnection)) {
        exit 1
    }
    
    Write-Host ""
    Write-Host "📋 Validating Namespaces..." -ForegroundColor Yellow
    Test-Namespaces
    
    Write-Host ""
    Write-Host "🚀 Validating Deployments..." -ForegroundColor Yellow
    Test-Deployments
    
    Write-Host ""
    Write-Host "🌐 Validating Services..." -ForegroundColor Yellow
    Test-Services
    
    Write-Host ""
    Write-Host "💾 Validating PVCs..." -ForegroundColor Yellow
    Test-PVCs
    
    Write-Host ""
    Write-Host "📈 Validating HPAs..." -ForegroundColor Yellow
    Test-HPAs
    
    Write-Host ""
    Write-Host "🏥 Checking Pod Health..." -ForegroundColor Yellow
    Test-PodHealth
    
    Write-Host ""
    Write-Host "🔗 Testing Connectivity..." -ForegroundColor Yellow
    Test-Connectivity
    
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Status "SUCCESS" "Smoke tests completed!"
    Write-Host "==================================================" -ForegroundColor Cyan
}

# Run main function
Main