# Docker build script for all agents - PowerShell Version
# This script builds Docker images for chatbot, fraud detection, and recommendation agents

param(
    [string]$ProjectId = "agentic-microservices",
    [string]$ImageTag = "latest",
    [string]$Registry = "gcr.io",
    [switch]$Push,
    [switch]$Help
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Function to print colored output
function Write-Status {
    param(
        [string]$Status,
        [string]$Message
    )
    
    switch ($Status) {
        "SUCCESS" { Write-Host "✅ $Message" -ForegroundColor Green }
        "ERROR" { Write-Host "❌ $Message" -ForegroundColor Red }
        "INFO" { Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
    }
}

# Function to show help
function Show-Help {
    Write-Host "Usage: .\build-agents.ps1 [OPTIONS]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -ProjectId ID      Set the project ID (default: agentic-microservices)" -ForegroundColor White
    Write-Host "  -ImageTag TAG      Set the image tag (default: latest)" -ForegroundColor White
    Write-Host "  -Registry REG      Set the registry (default: gcr.io)" -ForegroundColor White
    Write-Host "  -Push              Push images to registry after building" -ForegroundColor White
    Write-Host "  -Help              Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\build-agents.ps1" -ForegroundColor White
    Write-Host "  .\build-agents.ps1 -ProjectId my-project -ImageTag v1.0.0" -ForegroundColor White
    Write-Host "  .\build-agents.ps1 -Push" -ForegroundColor White
}

# Function to build Docker image
function Build-Image {
    param(
        [string]$AgentName,
        [string]$DockerfilePath
    )
    
    $imageName = "$Registry/$ProjectId/${AgentName}:$ImageTag"
    
    Write-Status "INFO" "Building Docker image for $AgentName..."
    
    try {
        $buildResult = docker build -t $imageName -f $DockerfilePath . 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Status "SUCCESS" "Built $imageName"
            
            # Test the image
            Write-Status "INFO" "Testing $AgentName image..."
            $testResult = docker run --rm $imageName node --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Status "SUCCESS" "Image $AgentName test passed"
                return $true
            } else {
                Write-Status "ERROR" "Image $AgentName test failed"
                return $false
            }
        } else {
            Write-Status "ERROR" "Failed to build $imageName"
            Write-Host $buildResult -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Status "ERROR" "Exception while building $imageName : $_"
        return $false
    }
}

# Function to push image to registry
function Push-Image {
    param(
        [string]$AgentName
    )
    
    $imageName = "$Registry/$ProjectId/${AgentName}:$ImageTag"
    
    if ($Push) {
        Write-Status "INFO" "Pushing $imageName to registry..."
        try {
            $pushResult = docker push $imageName 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Status "SUCCESS" "Pushed $imageName"
                return $true
            } else {
                Write-Status "ERROR" "Failed to push $imageName"
                Write-Host $pushResult -ForegroundColor Red
                return $false
            }
        }
        catch {
            Write-Status "ERROR" "Exception while pushing $imageName : $_"
            return $false
        }
    }
    return $true
}

# Main execution
function Main {
    if ($Help) {
        Show-Help
        return
    }
    
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "🐳 Building Docker Images for Agents" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "Project ID: $ProjectId" -ForegroundColor White
    Write-Host "Image Tag: $ImageTag" -ForegroundColor White
    Write-Host "Registry: $Registry" -ForegroundColor White
    Write-Host "==================================================" -ForegroundColor Cyan
    
    # Check if Docker is running
    try {
        $null = docker info 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Status "ERROR" "Docker is not running or not accessible"
            exit 1
        }
    }
    catch {
        Write-Status "ERROR" "Docker is not running or not accessible"
        exit 1
    }
    
    # Define agents and infrastructure services with their Dockerfiles
    $agents = @(
        @{Name="chatbot-agent"; Dockerfile="src/agents/chatbot/Dockerfile"},
        @{Name="fraud-detection-agent"; Dockerfile="src/agents/fraud-detection/Dockerfile"},
        @{Name="recommendation-agent"; Dockerfile="src/agents/recommendation/Dockerfile"},
        @{Name="mcp-gateway"; Dockerfile="src/integration/mcp/Dockerfile"},
        @{Name="a2a-hub"; Dockerfile="src/integration/a2a/Dockerfile"},
        @{Name="adk"; Dockerfile="src/infrastructure/adk/Dockerfile"}
    )
    
    $buildSuccess = $true
    $builtImages = @()
    
    # Build images for each agent
    foreach ($agent in $agents) {
        if (Build-Image -AgentName $agent.Name -DockerfilePath $agent.Dockerfile) {
            $builtImages += "$Registry/$ProjectId/$($agent.Name):$ImageTag"
        } else {
            $buildSuccess = $false
        }
    }
    
    if ($buildSuccess) {
        Write-Status "SUCCESS" "All agent images built successfully!"
        
        # Push images if requested
        if ($Push) {
            Write-Host ""
            Write-Host "📤 Pushing images to registry..." -ForegroundColor Yellow
            foreach ($agent in $agents) {
                Push-Image -AgentName $agent.Name
            }
        }
        
        Write-Host ""
        Write-Host "==================================================" -ForegroundColor Cyan
        Write-Status "SUCCESS" "Docker build process completed!"
        Write-Host "==================================================" -ForegroundColor Cyan
        
        # Show built images
        Write-Host ""
        Write-Host "📋 Built Images:" -ForegroundColor Yellow
        foreach ($image in $builtImages) {
            Write-Host "  - $image" -ForegroundColor White
        }
        
    } else {
        Write-Status "ERROR" "Some images failed to build"
        exit 1
    }
}

# Run main function
Main