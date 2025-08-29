#!/bin/bash

# Kubernetes Manifest Validation Script
# This script validates all Kubernetes manifests for syntax and basic structure

set -e

echo "🔍 Validating Kubernetes manifests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to validate YAML syntax
validate_yaml() {
    local file=$1
    echo -n "Validating YAML syntax for $file... "
    
    if kubectl --dry-run=client apply -f "$file" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        echo -e "${RED}Error in $file:${NC}"
        kubectl --dry-run=client apply -f "$file"
        return 1
    fi
}

# Function to validate resource structure
validate_structure() {
    local file=$1
    echo -n "Validating resource structure for $file... "
    
    # Check if file contains required fields
    if yq eval '.metadata.name' "$file" > /dev/null 2>&1 && \
       yq eval '.metadata.labels' "$file" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        echo -e "${RED}Missing required metadata fields in $file${NC}"
        return 1
    fi
}

# Function to validate namespace consistency
validate_namespaces() {
    echo "Checking namespace consistency..."
    
    # Extract all namespaces from manifests
    local declared_namespaces=$(yq eval '.metadata.namespace' k8s/namespaces.yaml | grep -v null | sort | uniq)
    local used_namespaces=$(find k8s -name "*.yaml" -not -name "namespaces.yaml" -exec yq eval '.metadata.namespace' {} \; | grep -v null | sort | uniq)
    
    echo "Declared namespaces: $declared_namespaces"
    echo "Used namespaces: $used_namespaces"
    
    # Check if all used namespaces are declared
    for ns in $used_namespaces; do
        if echo "$declared_namespaces" | grep -q "$ns"; then
            echo -e "${GREEN}✓${NC} Namespace $ns is properly declared"
        else
            echo -e "${RED}✗${NC} Namespace $ns is used but not declared"
            return 1
        fi
    done
}

# Function to validate service selectors
validate_service_selectors() {
    echo "Validating service selectors..."
    
    # This is a basic check - in a real environment, you'd validate against actual deployments
    local services=$(yq eval '.spec.selector.app' k8s/services.yaml | grep -v null)
    
    for service in $services; do
        echo -e "${YELLOW}ℹ${NC} Service selector found: $service (deployment validation needed)"
    done
}

# Main validation
main() {
    local exit_code=0
    
    echo "Starting Kubernetes manifest validation..."
    echo "========================================="
    
    # Check if required tools are available
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}kubectl is required but not installed${NC}"
        exit 1
    fi
    
    if ! command -v yq &> /dev/null; then
        echo -e "${YELLOW}yq is not installed, skipping advanced validation${NC}"
        SKIP_YQ=true
    fi
    
    # Validate each manifest file
    for file in k8s/*.yaml; do
        if [[ -f "$file" ]]; then
            echo "Processing $file..."
            
            if ! validate_yaml "$file"; then
                exit_code=1
            fi
            
            if [[ -z "$SKIP_YQ" ]] && ! validate_structure "$file"; then
                exit_code=1
            fi
            
            echo ""
        fi
    done
    
    # Additional validations
    if [[ -z "$SKIP_YQ" ]]; then
        if ! validate_namespaces; then
            exit_code=1
        fi
        
        validate_service_selectors
    fi
    
    echo "========================================="
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}✅ All validations passed!${NC}"
    else
        echo -e "${RED}❌ Some validations failed!${NC}"
    fi
    
    exit $exit_code
}

# Run main function
main "$@"