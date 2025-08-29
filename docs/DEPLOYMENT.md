# Agentic Microservices Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Agentic Microservices system to Google Kubernetes Engine (GKE) with all AI agents, integration services, and monitoring components.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Configuration Management](#configuration-management)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Service Configuration](#service-configuration)
6. [Monitoring Setup](#monitoring-setup)
7. [Security Configuration](#security-configuration)
8. [Performance Tuning](#performance-tuning)
9. [Troubleshooting](#troubleshooting)
10. [Backup and Recovery](#backup-and-recovery)

## Prerequisites

### System Requirements

- **Kubernetes Cluster**: GKE 1.24+ with 8+ vCPUs and 32GB+ RAM
- **Helm**: Version 3.8+
- **kubectl**: Version 1.24+
- **Docker**: Version 20.10+
- **Google Cloud SDK**: Latest version

### Required Services

- **Google Cloud Project** with billing enabled
- **Google Gemini AI API** with valid API key
- **Google Container Registry (GCR)** or Artifact Registry
- **Cloud SQL** (optional, for persistent storage)
- **Cloud Storage** (for backups and logs)

### Network Requirements

- **Inbound**: HTTPS (443), HTTP (80) for web interfaces
- **Internal**: Service mesh communication on ports 8080-8085
- **Outbound**: Access to Gemini AI API and external services

## Environment Setup

### 1. Google Cloud Project Setup

```bash
# Set project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable container.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable monitoring.googleapis.com
gcloud services enable logging.googleapis.com
```

### 2. Create GKE Cluster

```bash
# Create cluster with autopilot (recommended)
gcloud container clusters create-auto agentic-cluster \
  --region=us-central1 \
  --project=$PROJECT_ID

# Or create standard cluster
gcloud container clusters create agentic-cluster \
  --region=us-central1 \
  --num-nodes=3 \
  --machine-type=e2-standard-4 \
  --project=$PROJECT_ID
```

### 3. Configure kubectl

```bash
gcloud container clusters get-credentials agentic-cluster \
  --region=us-central1 \
  --project=$PROJECT_ID
```

## Configuration Management

### 1. Environment Variables

Create environment-specific configuration files:

```bash
# Production configuration
cp .env.example .env.production
```

Edit `.env.production` with production values:

```env
# Core Configuration
NODE_ENV=production
LOG_LEVEL=info

# Google Cloud
PROJECT_ID=your-project-id
REGION=us-central1

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-pro
GEMINI_RATE_LIMIT=300

# Service Endpoints
MCP_ENDPOINT=http://mcp-gateway:8080
A2A_ENDPOINT=http://a2a-hub:8081

# Database (if using Cloud SQL)
DB_HOST=your-cloud-sql-instance
DB_NAME=agentic_db
DB_USER=agentic_user
DB_PASSWORD=your-secure-password

# Redis (for caching)
REDIS_HOST=your-redis-instance
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Monitoring
PROMETHEUS_ENDPOINT=http://prometheus:9090
GRAFANA_ENDPOINT=http://grafana:3000
```

### 2. Kubernetes Secrets

Create secrets for sensitive data:

```bash
# Create Gemini API key secret
kubectl create secret generic gemini-secret \
  --from-literal=api-key=your-gemini-api-key

# Create database credentials secret
kubectl create secret generic db-secret \
  --from-literal=username=agentic_user \
  --from-literal=password=your-secure-password

# Create Redis credentials secret
kubectl create secret generic redis-secret \
  --from-literal=password=your-redis-password
```

### 3. ConfigMaps

Create configuration maps:

```bash
# Create application config
kubectl create configmap agentic-config \
  --from-env-file=.env.production

# Create service discovery config
kubectl create configmap service-discovery \
  --from-file=services.json
```

## Kubernetes Deployment

### 1. Deploy Infrastructure

```bash
# Deploy namespaces
kubectl apply -f k8s/namespaces.yaml

# Deploy persistent volumes
kubectl apply -f k8s/pvc.yaml

# Deploy ConfigMaps and Secrets
kubectl apply -f k8s/configmaps.yaml
kubectl apply -f k8s/secrets.yaml
```

### 2. Deploy Core Services

```bash
# Deploy MCP Gateway
kubectl apply -f k8s/deployments/mcp-gateway.yaml

# Deploy A2A Hub
kubectl apply -f k8s/deployments/a2a-hub.yaml

# Deploy Infrastructure Services
kubectl apply -f k8s/deployments/infrastructure.yaml
```

### 3. Deploy AI Agents

```bash
# Deploy Chatbot Agent
kubectl apply -f k8s/deployments/chatbot-agent.yaml

# Deploy Fraud Detection Agent
kubectl apply -f k8s/deployments/fraud-detection-agent.yaml

# Deploy Recommendation Agent
kubectl apply -f k8s/deployments/recommendation-agent.yaml
```

### 4. Deploy Ingress and Services

```bash
# Deploy services
kubectl apply -f k8s/services.yaml

# Deploy ingress
kubectl apply -f k8s/ingress.yaml

# Deploy HPA (Horizontal Pod Autoscaler)
kubectl apply -f k8s/hpa.yaml
```

## Service Configuration

### 1. MCP Gateway Configuration

The MCP Gateway routes requests between microservices:

```yaml
# Example MCP Gateway config
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-gateway-config
data:
  config.json: |
    {
      "port": 8080,
      "services": {
        "user-service": "http://user-service:8080",
        "transaction-service": "http://transaction-service:8080",
        "product-service": "http://product-service:8080"
      },
      "rateLimit": {
        "windowMs": 60000,
        "maxRequests": 1000
      }
    }
```

### 2. A2A Hub Configuration

Configure agent-to-agent communication:

```yaml
# Example A2A Hub config
apiVersion: v1
kind: ConfigMap
metadata:
  name: a2a-hub-config
data:
  config.json: |
    {
      "port": 8081,
      "agents": {
        "chatbot": "chatbot-agent:8080",
        "fraud-detection": "fraud-detection-agent:8080",
        "recommendation": "recommendation-agent:8080"
      },
      "messageRetention": 86400000,
      "maxRetries": 3
    }
```

### 3. Agent-Specific Configuration

Each agent has specific configuration requirements:

#### Chatbot Agent
```yaml
env:
  - name: AGENT_TYPE
    value: "chatbot"
  - name: SESSION_TIMEOUT
    value: "1800000"  # 30 minutes
  - name: MAX_HISTORY_LENGTH
    value: "50"
```

#### Fraud Detection Agent
```yaml
env:
  - name: AGENT_TYPE
    value: "fraud-detection"
  - name: RISK_THRESHOLD_HIGH
    value: "0.8"
  - name: RISK_THRESHOLD_CRITICAL
    value: "0.95"
```

#### Recommendation Agent
```yaml
env:
  - name: AGENT_TYPE
    value: "recommendation"
  - name: CACHE_TTL
    value: "3600000"  # 1 hour
  - name: MAX_RECOMMENDATIONS
    value: "10"
```

## Monitoring Setup

### 1. Prometheus and Grafana

```bash
# Install Prometheus using Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/prometheus

# Install Grafana
helm repo add grafana https://grafana.github.io/helm-charts
helm install grafana grafana/grafana
```

### 2. Custom Dashboards

Import the provided Grafana dashboards:

```bash
# Apply custom dashboards
kubectl apply -f k8s/monitoring/grafana-dashboards.yaml
```

### 3. Alert Rules

Configure alerting rules:

```bash
# Apply Prometheus rules
kubectl apply -f k8s/monitoring/prometheus-rules.yaml
```

## Security Configuration

### 1. Network Policies

```bash
# Apply network policies
kubectl apply -f k8s/security/network-policies.yaml
```

### 2. RBAC Configuration

```bash
# Apply RBAC rules
kubectl apply -f k8s/rbac.yaml
```

### 3. TLS Certificates

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Create TLS certificate
kubectl apply -f k8s/security/tls-certificate.yaml
```

## Performance Tuning

### 1. Resource Limits

```yaml
# Example resource limits for agents
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

### 2. HPA Configuration

```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: chatbot-agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: chatbot-agent
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 3. Database Optimization

```sql
-- Create optimized indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_timestamp ON transactions(created_at);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
```

## Troubleshooting

### Common Issues

#### 1. Agent Initialization Failures

```bash
# Check agent logs
kubectl logs -f deployment/chatbot-agent

# Check agent status
kubectl get pods -l app=chatbot-agent
```

#### 2. Service Communication Issues

```bash
# Test service connectivity
kubectl exec -it deployment/mcp-gateway -- curl http://user-service:8080/health

# Check service endpoints
kubectl get endpoints
```

#### 3. Performance Issues

```bash
# Check resource usage
kubectl top pods

# Check HPA status
kubectl get hpa
```

### Debug Commands

```bash
# Get all resources
kubectl get all --all-namespaces

# Check events
kubectl get events --sort-by=.metadata.creationTimestamp

# Debug network issues
kubectl run debug --image=busybox --rm -it -- sh
```

## Backup and Recovery

### 1. Database Backup

```bash
# Create backup job
kubectl apply -f k8s/backup/database-backup.yaml

# Run manual backup
kubectl create job manual-backup --from=cronjob/database-backup
```

### 2. Configuration Backup

```bash
# Backup ConfigMaps and Secrets
kubectl get configmaps -o yaml > configmaps-backup.yaml
kubectl get secrets -o yaml > secrets-backup.yaml
```

### 3. Disaster Recovery

```bash
# Restore from backup
kubectl apply -f configmaps-backup.yaml
kubectl apply -f secrets-backup.yaml

# Rollback deployment
kubectl rollout undo deployment/chatbot-agent
```

## Validation Checklist

- [ ] GKE cluster created and configured
- [ ] All required APIs enabled
- [ ] Secrets and ConfigMaps created
- [ ] Core services deployed (MCP Gateway, A2A Hub)
- [ ] All agents deployed and healthy
- [ ] Ingress configured and accessible
- [ ] Monitoring stack operational
- [ ] Security policies applied
- [ ] Backup procedures tested
- [ ] Performance benchmarks completed

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs: `kubectl logs -f deployment/<service-name>`
3. Check monitoring dashboards
4. Contact the development team

---

**Deployment completed successfully!** 🎉

The Agentic Microservices system is now fully deployed and operational on Google Kubernetes Engine.