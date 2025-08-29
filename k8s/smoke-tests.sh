#!/bin/bash

# Kubernetes Deployment Smoke Tests
# This script performs basic smoke tests to validate deployments

set -e

echo "🚀 Starting Kubernetes Deployment Smoke Tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "INFO")
            echo -e "${YELLOW}ℹ️  $message${NC}"
            ;;
    esac
}

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_status "ERROR" "kubectl is not installed or not in PATH"
        exit 1
    fi
    print_status "SUCCESS" "kubectl is available"
}

# Function to check cluster connectivity
check_cluster_connection() {
    if kubectl cluster-info &> /dev/null; then
        print_status "SUCCESS" "Connected to Kubernetes cluster"
    else
        print_status "ERROR" "Cannot connect to Kubernetes cluster"
        exit 1
    fi
}

# Function to check if namespaces exist
check_namespaces() {
    local namespaces=("ai-agents" "integration" "infrastructure")
    
    for namespace in "${namespaces[@]}"; do
        if kubectl get namespace "$namespace" &> /dev/null; then
            print_status "SUCCESS" "Namespace '$namespace' exists"
        else
            print_status "ERROR" "Namespace '$namespace' does not exist"
            return 1
        fi
    done
}

# Function to validate deployments
validate_deployments() {
    local deployments=(
        "ai-agents:chatbot-agent"
        "ai-agents:fraud-detection-agent"
        "ai-agents:recommendation-agent"
        "integration:mcp-gateway"
        "integration:a2a-hub"
        "integration:redis"
        "infrastructure:adk-service"
    )
    
    for deployment in "${deployments[@]}"; do
        local namespace=$(echo "$deployment" | cut -d: -f1)
        local name=$(echo "$deployment" | cut -d: -f2)
        
        # Check if deployment exists
        if kubectl get deployment "$name" -n "$namespace" &> /dev/null; then
            print_status "SUCCESS" "Deployment '$name' exists in namespace '$namespace'"
            
            # Check deployment status
            local ready_replicas=$(kubectl get deployment "$name" -n "$namespace" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            local desired_replicas=$(kubectl get deployment "$name" -n "$namespace" -o jsonpath='{.spec.replicas}')
            
            if [ "$ready_replicas" = "$desired_replicas" ] && [ "$ready_replicas" != "0" ]; then
                print_status "SUCCESS" "Deployment '$name' is ready ($ready_replicas/$desired_replicas replicas)"
            else
                print_status "WARNING" "Deployment '$name' is not fully ready ($ready_replicas/$desired_replicas replicas)"
            fi
        else
            print_status "ERROR" "Deployment '$name' does not exist in namespace '$namespace'"
        fi
    done
}

# Function to validate services
validate_services() {
    local services=(
        "ai-agents:chatbot-agent"
        "ai-agents:fraud-detection-agent"
        "ai-agents:recommendation-agent"
        "integration:mcp-gateway"
        "integration:a2a-hub"
        "integration:redis"
        "infrastructure:adk-service"
    )
    
    for service in "${services[@]}"; do
        local namespace=$(echo "$service" | cut -d: -f1)
        local name=$(echo "$service" | cut -d: -f2)
        
        if kubectl get service "$name" -n "$namespace" &> /dev/null; then
            print_status "SUCCESS" "Service '$name' exists in namespace '$namespace'"
            
            # Check if service has endpoints
            local endpoints=$(kubectl get endpoints "$name" -n "$namespace" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || echo "")
            if [ -n "$endpoints" ]; then
                print_status "SUCCESS" "Service '$name' has active endpoints"
            else
                print_status "WARNING" "Service '$name' has no active endpoints"
            fi
        else
            print_status "ERROR" "Service '$name' does not exist in namespace '$namespace'"
        fi
    done
}

# Function to validate PVCs
validate_pvcs() {
    local pvcs=(
        "ai-agents:chatbot-agent-pvc"
        "ai-agents:fraud-detection-agent-pvc"
        "ai-agents:fraud-detection-models-pvc"
        "ai-agents:recommendation-agent-pvc"
        "integration:redis-pvc"
        "infrastructure:adk-templates-pvc"
    )
    
    for pvc in "${pvcs[@]}"; do
        local namespace=$(echo "$pvc" | cut -d: -f1)
        local name=$(echo "$pvc" | cut -d: -f2)
        
        if kubectl get pvc "$name" -n "$namespace" &> /dev/null; then
            local status=$(kubectl get pvc "$name" -n "$namespace" -o jsonpath='{.status.phase}')
            if [ "$status" = "Bound" ]; then
                print_status "SUCCESS" "PVC '$name' is bound in namespace '$namespace'"
            else
                print_status "WARNING" "PVC '$name' status is '$status' in namespace '$namespace'"
            fi
        else
            print_status "ERROR" "PVC '$name' does not exist in namespace '$namespace'"
        fi
    done
}

# Function to validate HPAs
validate_hpas() {
    local hpas=(
        "ai-agents:chatbot-agent-hpa"
        "ai-agents:fraud-detection-agent-hpa"
        "ai-agents:recommendation-agent-hpa"
        "integration:mcp-gateway-hpa"
        "integration:a2a-hub-hpa"
    )
    
    for hpa in "${hpas[@]}"; do
        local namespace=$(echo "$hpa" | cut -d: -f1)
        local name=$(echo "$hpa" | cut -d: -f2)
        
        if kubectl get hpa "$name" -n "$namespace" &> /dev/null; then
            print_status "SUCCESS" "HPA '$name' exists in namespace '$namespace'"
            
            # Check HPA status
            local current_replicas=$(kubectl get hpa "$name" -n "$namespace" -o jsonpath='{.status.currentReplicas}' 2>/dev/null || echo "0")
            local desired_replicas=$(kubectl get hpa "$name" -n "$namespace" -o jsonpath='{.status.desiredReplicas}' 2>/dev/null || echo "0")
            
            if [ "$current_replicas" != "0" ] && [ "$desired_replicas" != "0" ]; then
                print_status "SUCCESS" "HPA '$name' is active ($current_replicas/$desired_replicas replicas)"
            else
                print_status "WARNING" "HPA '$name' metrics may not be available yet"
            fi
        else
            print_status "ERROR" "HPA '$name' does not exist in namespace '$namespace'"
        fi
    done
}

# Function to check pod health
check_pod_health() {
    local namespaces=("ai-agents" "integration" "infrastructure")
    
    for namespace in "${namespaces[@]}"; do
        print_status "INFO" "Checking pod health in namespace '$namespace'"
        
        local pods=$(kubectl get pods -n "$namespace" --no-headers 2>/dev/null || echo "")
        if [ -z "$pods" ]; then
            print_status "WARNING" "No pods found in namespace '$namespace'"
            continue
        fi
        
        while IFS= read -r pod_line; do
            if [ -n "$pod_line" ]; then
                local pod_name=$(echo "$pod_line" | awk '{print $1}')
                local ready=$(echo "$pod_line" | awk '{print $2}')
                local status=$(echo "$pod_line" | awk '{print $3}')
                
                if [ "$status" = "Running" ] && [[ "$ready" =~ ^[1-9]/[1-9] ]]; then
                    print_status "SUCCESS" "Pod '$pod_name' is healthy ($ready, $status)"
                else
                    print_status "WARNING" "Pod '$pod_name' status: $ready, $status"
                fi
            fi
        done <<< "$pods"
    done
}

# Function to test basic connectivity
test_connectivity() {
    print_status "INFO" "Testing basic service connectivity..."
    
    # Test if we can reach services (this would require the services to be actually running)
    # For now, we'll just check if the services are properly configured
    local services=("mcp-gateway" "a2a-hub" "redis")
    
    for service in "${services[@]}"; do
        local service_ip=$(kubectl get service "$service" -n integration -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
        if [ -n "$service_ip" ] && [ "$service_ip" != "None" ]; then
            print_status "SUCCESS" "Service '$service' has cluster IP: $service_ip"
        else
            print_status "WARNING" "Service '$service' has no cluster IP assigned"
        fi
    done
}

# Main execution
main() {
    echo "=================================================="
    echo "🧪 Kubernetes Deployment Smoke Tests"
    echo "=================================================="
    
    check_kubectl
    check_cluster_connection
    
    echo ""
    echo "📋 Validating Namespaces..."
    check_namespaces
    
    echo ""
    echo "🚀 Validating Deployments..."
    validate_deployments
    
    echo ""
    echo "🌐 Validating Services..."
    validate_services
    
    echo ""
    echo "💾 Validating PVCs..."
    validate_pvcs
    
    echo ""
    echo "📈 Validating HPAs..."
    validate_hpas
    
    echo ""
    echo "🏥 Checking Pod Health..."
    check_pod_health
    
    echo ""
    echo "🔗 Testing Connectivity..."
    test_connectivity
    
    echo ""
    echo "=================================================="
    print_status "SUCCESS" "Smoke tests completed!"
    echo "=================================================="
}

# Run main function
main "$@"