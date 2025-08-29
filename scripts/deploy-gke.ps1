# One-Click Deployment Script for GKE
# This script deploys the entire agentic microservices system to Google Kubernetes Engine

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-central1",
    
    [Parameter(Mandatory=$false)]
    [string]$ClusterName = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$CreateCluster,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [string]$ConfigPath = "./config",
    
    [Parameter(Mandatory=$false)]
    [string]$ImageTag = "latest"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$Cyan = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-Banner {
    param([string]$Title)
    Write-ColorOutput "`n$('=' * 80)" $Cyan
    Write-ColorOutput "  $Title" $Cyan
    Write-ColorOutput "$('=' * 80)" $Cyan
}

function Test-Prerequisites {
    Write-Banner "CHECKING PREREQUISITES"
    
    $prerequisites = @(
        @{ Name = "gcloud"; Command = "gcloud version" },
        @{ Name = "kubectl"; Command = "kubectl version --client" },
        @{ Name = "docker"; Command = "docker --version" },
        @{ Name = "node"; Command = "node --version" }
    )
    
    foreach ($prereq in $prerequisites) {
        try {
            Invoke-Expression $prereq.Command | Out-Null
            Write-ColorOutput "✓ $($prereq.Name) is installed" $Green
        }
        catch {
            Write-ColorOutput "✗ $($prereq.Name) is not installed or not in PATH" $Red
            exit 1
        }
    }
    
    # Check if user is authenticated with gcloud
    try {
        $account = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
        if ($account) {
            Write-ColorOutput "✓ Authenticated with gcloud as: $account" $Green
        }
        else {
            Write-ColorOutput "✗ Not authenticated with gcloud. Run 'gcloud auth login'" $Red
            exit 1
        }
    }
    catch {
        Write-ColorOutput "✗ Failed to check gcloud authentication" $Red
        exit 1
    }
}

function Initialize-Configuration {
    Write-Banner "INITIALIZING CONFIGURATION"
    
    # Load configuration
    $configFile = Join-Path $ConfigPath "environments" "$Environment.yaml"
    if (-not (Test-Path $configFile)) {
        Write-ColorOutput "✗ Configuration file not found: $configFile" $Red
        exit 1
    }
    
    # Parse configuration (simplified YAML parsing)
    $configContent = Get-Content $configFile -Raw
    
    # Extract values using regex (in production, use proper YAML parser)
    if ($configContent -match "project_id:\s*[`"']?([^`"'\r\n]+)[`"']?") {
        $script:ProjectId = if ($ProjectId) { $ProjectId } else { $matches[1].Trim() }
    }
    
    if ($configContent -match "region:\s*[`"']?([^`"'\r\n]+)[`"']?") {
        $script:Region = if ($Region -eq "us-central1") { $matches[1].Trim() } else { $Region }
    }
    
    if ($configContent -match "cluster_name:\s*[`"']?([^`"'\r\n]+)[`"']?") {
        $script:ClusterName = if ($ClusterName) { $ClusterName } else { $matches[1].Trim() }
    }
    
    if ($configContent -match "namespace:\s*[`"']?([^`"'\r\n]+)[`"']?") {
        $script:Namespace = $matches[1].Trim()
    }
    
    Write-ColorOutput "Configuration loaded:" $Blue
    Write-ColorOutput "  Project ID: $script:ProjectId" $Blue
    Write-ColorOutput "  Region: $script:Region" $Blue
    Write-ColorOutput "  Cluster: $script:ClusterName" $Blue
    Write-ColorOutput "  Namespace: $script:Namespace" $Blue
    Write-ColorOutput "  Environment: $Environment" $Blue
}

function Set-GCloudProject {
    Write-Banner "SETTING UP GOOGLE CLOUD PROJECT"
    
    Write-ColorOutput "Setting active project to: $script:ProjectId" $Blue
    gcloud config set project $script:ProjectId
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "✗ Failed to set project" $Red
        exit 1
    }
    
    # Enable required APIs
    $apis = @(
        "container.googleapis.com",
        "compute.googleapis.com",
        "monitoring.googleapis.com",
        "logging.googleapis.com",
        "cloudresourcemanager.googleapis.com"
    )
    
    Write-ColorOutput "Enabling required APIs..." $Blue
    foreach ($api in $apis) {
        Write-ColorOutput "  Enabling $api..." $Blue
        gcloud services enable $api --quiet
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "  ✓ $api enabled" $Green
        }
        else {
            Write-ColorOutput "  ✗ Failed to enable $api" $Red
        }
    }
}

function New-GKECluster {
    if (-not $CreateCluster) {
        Write-ColorOutput "Skipping cluster creation (use -CreateCluster to create)" $Yellow
        return
    }
    
    Write-Banner "CREATING GKE CLUSTER"
    
    $clusterConfig = @{
        "development" = @{
            "machine-type" = "e2-standard-4"
            "num-nodes" = "3"
            "disk-size" = "50GB"
            "enable-autoscaling" = $true
            "min-nodes" = "1"
            "max-nodes" = "10"
        }
        "staging" = @{
            "machine-type" = "e2-standard-8"
            "num-nodes" = "5"
            "disk-size" = "100GB"
            "enable-autoscaling" = $true
            "min-nodes" = "3"
            "max-nodes" = "20"
        }
        "production" = @{
            "machine-type" = "e2-standard-16"
            "num-nodes" = "10"
            "disk-size" = "200GB"
            "enable-autoscaling" = $true
            "min-nodes" = "5"
            "max-nodes" = "50"
        }
    }
    
    $config = $clusterConfig[$Environment]
    
    Write-ColorOutput "Creating GKE cluster: $script:ClusterName" $Blue
    Write-ColorOutput "  Machine Type: $($config.'machine-type')" $Blue
    Write-ColorOutput "  Initial Nodes: $($config.'num-nodes')" $Blue
    Write-ColorOutput "  Disk Size: $($config.'disk-size')" $Blue
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would create cluster with above configuration" $Yellow
        return
    }
    
    $createCommand = @(
        "gcloud container clusters create $script:ClusterName",
        "--region=$script:Region",
        "--machine-type=$($config.'machine-type')",
        "--num-nodes=$($config.'num-nodes')",
        "--disk-size=$($config.'disk-size')",
        "--enable-autoscaling",
        "--min-nodes=$($config.'min-nodes')",
        "--max-nodes=$($config.'max-nodes')",
        "--enable-autorepair",
        "--enable-autoupgrade",
        "--enable-ip-alias",
        "--network=default",
        "--subnetwork=default",
        "--enable-stackdriver-kubernetes",
        "--addons=HorizontalPodAutoscaling,HttpLoadBalancing,NetworkPolicy",
        "--enable-network-policy",
        "--maintenance-window-start=2025-01-01T02:00:00Z",
        "--maintenance-window-end=2025-01-01T06:00:00Z",
        "--maintenance-window-recurrence='FREQ=WEEKLY;BYDAY=SA'",
        "--quiet"
    )
    
    $fullCommand = $createCommand -join " "
    Write-ColorOutput "Executing: $fullCommand" $Blue
    
    Invoke-Expression $fullCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ GKE cluster created successfully" $Green
    }
    else {
        Write-ColorOutput "✗ Failed to create GKE cluster" $Red
        exit 1
    }
}

function Connect-GKECluster {
    Write-Banner "CONNECTING TO GKE CLUSTER"
    
    Write-ColorOutput "Getting cluster credentials..." $Blue
    gcloud container clusters get-credentials $script:ClusterName --region=$script:Region --project=$script:ProjectId
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "✗ Failed to get cluster credentials" $Red
        exit 1
    }
    
    # Verify connection
    $nodes = kubectl get nodes --no-headers 2>$null
    if ($nodes) {
        $nodeCount = ($nodes | Measure-Object).Count
        Write-ColorOutput "✓ Connected to cluster with $nodeCount nodes" $Green
    }
    else {
        Write-ColorOutput "✗ Failed to connect to cluster" $Red
        exit 1
    }
}

function Build-DockerImages {
    if ($SkipBuild) {
        Write-ColorOutput "Skipping Docker image build" $Yellow
        return
    }
    
    Write-Banner "BUILDING DOCKER IMAGES"
    
    # Configure Docker to use gcloud as credential helper
    gcloud auth configure-docker --quiet
    
    $services = @(
        "chatbot-agent",
        "fraud-detection-agent", 
        "recommendation-agent",
        "mcp-gateway",
        "a2a-hub",
        "adk"
    )
    
    foreach ($service in $services) {
        Write-ColorOutput "Building $service..." $Blue
        
        $imageName = "gcr.io/$script:ProjectId/$service"
        $imageTag = "$imageName`:$ImageTag"
        
        if ($DryRun) {
            Write-ColorOutput "DRY RUN: Would build $imageTag" $Yellow
            continue
        }
        
        # Build image
        docker build -t $imageTag -f "docker/Dockerfile.$service" .
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ Built $imageTag" $Green
            
            # Push image
            Write-ColorOutput "Pushing $imageTag..." $Blue
            docker push $imageTag
            
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "✓ Pushed $imageTag" $Green
            }
            else {
                Write-ColorOutput "✗ Failed to push $imageTag" $Red
            }
        }
        else {
            Write-ColorOutput "✗ Failed to build $imageTag" $Red
        }
    }
}

function Deploy-Infrastructure {
    Write-Banner "DEPLOYING INFRASTRUCTURE"
    
    # Deploy namespaces
    Write-ColorOutput "Creating namespaces..." $Blue
    if (-not $DryRun) {
        kubectl apply -f k8s/namespaces.yaml
    }
    else {
        Write-ColorOutput "DRY RUN: Would apply namespaces" $Yellow
    }
    
    # Deploy RBAC
    Write-ColorOutput "Applying RBAC configurations..." $Blue
    if (-not $DryRun) {
        kubectl apply -f k8s/rbac.yaml
    }
    else {
        Write-ColorOutput "DRY RUN: Would apply RBAC" $Yellow
    }
    
    # Deploy PVCs
    Write-ColorOutput "Creating Persistent Volume Claims..." $Blue
    if (-not $DryRun) {
        kubectl apply -f k8s/pvc.yaml
    }
    else {
        Write-ColorOutput "DRY RUN: Would apply PVCs" $Yellow
    }
}

function Deploy-Configuration {
    Write-Banner "DEPLOYING CONFIGURATION"
    
    # Deploy configuration using config-deploy script
    $configDeployArgs = @(
        "-Environment", $Environment,
        "-ConfigPath", $ConfigPath
    )
    
    if ($DryRun) {
        $configDeployArgs += "-DryRun"
    }
    
    if ($Force) {
        $configDeployArgs += "-Force"
    }
    
    Write-ColorOutput "Deploying configuration..." $Blue
    & "$PSScriptRoot/config-deploy.ps1" @configDeployArgs
    
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "✗ Configuration deployment failed" $Red
        exit 1
    }
}

function Deploy-Applications {
    Write-Banner "DEPLOYING APPLICATIONS"
    
    # Update image tags in deployment manifests
    if (-not $DryRun) {
        Update-DeploymentImages
    }
    
    # Deploy applications
    Write-ColorOutput "Deploying applications..." $Blue
    if (-not $DryRun) {
        kubectl apply -f k8s/deployments.yaml -n $script:Namespace
        kubectl apply -f k8s/services.yaml -n $script:Namespace
        kubectl apply -f k8s/ingress.yaml -n $script:Namespace
        kubectl apply -f k8s/hpa.yaml -n $script:Namespace
    }
    else {
        Write-ColorOutput "DRY RUN: Would deploy applications" $Yellow
    }
}

function Update-DeploymentImages {
    Write-ColorOutput "Updating deployment images..." $Blue
    
    $deploymentFile = "k8s/deployments.yaml"
    $content = Get-Content $deploymentFile -Raw
    
    # Update image references
    $services = @(
        "chatbot-agent",
        "fraud-detection-agent", 
        "recommendation-agent",
        "mcp-gateway",
        "a2a-hub",
        "adk"
    )
    
    foreach ($service in $services) {
        $oldPattern = "image: gcr\.io/[^/]+/$service:[^\s]+"
        $newImage = "image: gcr.io/$script:ProjectId/$service`:$ImageTag"
        $content = $content -replace $oldPattern, $newImage
    }
    
    Set-Content $deploymentFile $content
    Write-ColorOutput "✓ Updated deployment images" $Green
}

function Wait-ForDeployment {
    Write-Banner "WAITING FOR DEPLOYMENT"
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would wait for deployments" $Yellow
        return
    }
    
    $deployments = @(
        "chatbot-agent",
        "fraud-detection-agent",
        "recommendation-agent",
        "mcp-gateway",
        "a2a-hub",
        "adk"
    )
    
    foreach ($deployment in $deployments) {
        Write-ColorOutput "Waiting for $deployment to be ready..." $Blue
        kubectl rollout status deployment/$deployment -n $script:Namespace --timeout=300s
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ $deployment is ready" $Green
        }
        else {
            Write-ColorOutput "✗ $deployment failed to become ready" $Red
        }
    }
}

function Test-Deployment {
    Write-Banner "TESTING DEPLOYMENT"
    
    if ($DryRun) {
        Write-ColorOutput "DRY RUN: Would test deployment" $Yellow
        return
    }
    
    # Run smoke tests
    Write-ColorOutput "Running smoke tests..." $Blue
    & "$PSScriptRoot/../k8s/smoke-tests.ps1" -Namespace $script:Namespace
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Smoke tests passed" $Green
    }
    else {
        Write-ColorOutput "⚠ Some smoke tests failed" $Yellow
    }
    
    # Check pod status
    Write-ColorOutput "Checking pod status..." $Blue
    kubectl get pods -n $script:Namespace
    
    # Check service endpoints
    Write-ColorOutput "Checking service endpoints..." $Blue
    kubectl get services -n $script:Namespace
    
    # Check ingress
    Write-ColorOutput "Checking ingress..." $Blue
    kubectl get ingress -n $script:Namespace
}

function Show-DeploymentSummary {
    Write-Banner "DEPLOYMENT SUMMARY"
    
    Write-ColorOutput "Environment: $Environment" $Blue
    Write-ColorOutput "Project ID: $script:ProjectId" $Blue
    Write-ColorOutput "Region: $script:Region" $Blue
    Write-ColorOutput "Cluster: $script:ClusterName" $Blue
    Write-ColorOutput "Namespace: $script:Namespace" $Blue
    Write-ColorOutput "Image Tag: $ImageTag" $Blue
    Write-ColorOutput "Dry Run: $DryRun" $Blue
    
    if (-not $DryRun) {
        Write-ColorOutput "`nDeployed Resources:" $Blue
        kubectl get all -n $script:Namespace
        
        Write-ColorOutput "`nCluster Information:" $Blue
        kubectl cluster-info
        
        Write-ColorOutput "`nAccess Information:" $Blue
        $ingressIP = kubectl get ingress -n $script:Namespace -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>$null
        if ($ingressIP) {
            Write-ColorOutput "External IP: $ingressIP" $Green
            Write-ColorOutput "Chatbot API: http://$ingressIP/api/chatbot" $Green
            Write-ColorOutput "MCP Gateway: http://$ingressIP/api/mcp" $Green
            Write-ColorOutput "A2A Hub: http://$ingressIP/api/a2a" $Green
        }
        else {
            Write-ColorOutput "External IP not yet assigned" $Yellow
        }
    }
}

# Main execution
try {
    Write-Banner "AGENTIC MICROSERVICES GKE DEPLOYMENT"
    Write-ColorOutput "Starting deployment for environment: $Environment" $Blue
    
    # Initialize variables
    $script:ProjectId = $ProjectId
    $script:Region = $Region
    $script:ClusterName = $ClusterName
    $script:Namespace = ""
    
    # Execute deployment steps
    Test-Prerequisites
    Initialize-Configuration
    Set-GCloudProject
    New-GKECluster
    Connect-GKECluster
    Build-DockerImages
    Deploy-Infrastructure
    Deploy-Configuration
    Deploy-Applications
    Wait-ForDeployment
    Test-Deployment
    Show-DeploymentSummary
    
    Write-ColorOutput "`n🎉 Deployment completed successfully!" $Green
    Write-ColorOutput "Your agentic microservices system is now running on GKE!" $Green
    
}
catch {
    Write-ColorOutput "`n💥 Deployment failed: $($_.Exception.Message)" $Red
    Write-ColorOutput "Check the logs above for more details." $Red
    exit 1
}