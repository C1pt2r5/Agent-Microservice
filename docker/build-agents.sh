#!/bin/bash

# Docker build script for all agents
# This script builds Docker images for chatbot, fraud detection, and recommendation agents

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${PROJECT_ID:-"agentic-microservices"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}
REGISTRY=${REGISTRY:-"gcr.io"}

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${YELLOW}ℹ️  $message${NC}"
            ;;
    esac
}

# Function to build Docker image
build_image() {
    local agent_name=$1
    local dockerfile_path=$2
    local image_name="${REGISTRY}/${PROJECT_ID}/${agent_name}:${IMAGE_TAG}"
    
    print_status "INFO" "Building Docker image for ${agent_name}..."
    
    if docker build -t "${image_name}" -f "${dockerfile_path}" .; then
        print_status "SUCCESS" "Built ${image_name}"
        
        # Test the image
        print_status "INFO" "Testing ${agent_name} image..."
        if docker run --rm "${image_name}" node --version > /dev/null 2>&1; then
            print_status "SUCCESS" "Image ${agent_name} test passed"
        else
            print_status "ERROR" "Image ${agent_name} test failed"
            return 1
        fi
    else
        print_status "ERROR" "Failed to build ${image_name}"
        return 1
    fi
}

# Function to push image to registry
push_image() {
    local agent_name=$1
    local image_name="${REGISTRY}/${PROJECT_ID}/${agent_name}:${IMAGE_TAG}"
    
    if [ "${PUSH_IMAGES}" = "true" ]; then
        print_status "INFO" "Pushing ${image_name} to registry..."
        if docker push "${image_name}"; then
            print_status "SUCCESS" "Pushed ${image_name}"
        else
            print_status "ERROR" "Failed to push ${image_name}"
            return 1
        fi
    fi
}

# Main execution
main() {
    echo "=================================================="
    echo "🐳 Building Docker Images for Agents"
    echo "=================================================="
    echo "Project ID: ${PROJECT_ID}"
    echo "Image Tag: ${IMAGE_TAG}"
    echo "Registry: ${REGISTRY}"
    echo "=================================================="
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_status "ERROR" "Docker is not running or not accessible"
        exit 1
    fi
    
    # Build images for each agent and infrastructure service
    local agents=(
        "chatbot-agent:src/agents/chatbot/Dockerfile"
        "fraud-detection-agent:src/agents/fraud-detection/Dockerfile"
        "recommendation-agent:src/agents/recommendation/Dockerfile"
        "mcp-gateway:src/integration/mcp/Dockerfile"
        "a2a-hub:src/integration/a2a/Dockerfile"
        "adk:src/infrastructure/adk/Dockerfile"
    )
    
    local build_success=true
    
    for agent_info in "${agents[@]}"; do
        local agent_name=$(echo "$agent_info" | cut -d: -f1)
        local dockerfile_path=$(echo "$agent_info" | cut -d: -f2)
        
        if ! build_image "$agent_name" "$dockerfile_path"; then
            build_success=false
        fi
    done
    
    if [ "$build_success" = true ]; then
        print_status "SUCCESS" "All agent images built successfully!"
        
        # Push images if requested
        if [ "${PUSH_IMAGES}" = "true" ]; then
            echo ""
            echo "📤 Pushing images to registry..."
            for agent_info in "${agents[@]}"; do
                local agent_name=$(echo "$agent_info" | cut -d: -f1)
                push_image "$agent_name"
            done
        fi
        
        echo ""
        echo "=================================================="
        print_status "SUCCESS" "Docker build process completed!"
        echo "=================================================="
        
        # Show built images
        echo ""
        echo "📋 Built Images:"
        for agent_info in "${agents[@]}"; do
            local agent_name=$(echo "$agent_info" | cut -d: -f1)
            local image_name="${REGISTRY}/${PROJECT_ID}/${agent_name}:${IMAGE_TAG}"
            echo "  - ${image_name}"
        done
        
    else
        print_status "ERROR" "Some images failed to build"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --project-id)
            PROJECT_ID="$2"
            shift 2
            ;;
        --tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        --push)
            PUSH_IMAGES="true"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --project-id ID    Set the project ID (default: agentic-microservices)"
            echo "  --tag TAG          Set the image tag (default: latest)"
            echo "  --registry REG     Set the registry (default: gcr.io)"
            echo "  --push             Push images to registry after building"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main "$@"