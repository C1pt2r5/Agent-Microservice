# Troubleshooting Guide

## Overview

This guide provides solutions for common issues encountered when deploying, configuring, and operating the Agentic Microservices system.

## Table of Contents

1. [Deployment Issues](#deployment-issues)
2. [Service Communication Problems](#service-communication-problems)
3. [Agent-Specific Issues](#agent-specific-issues)
4. [Performance Problems](#performance-problems)
5. [Monitoring and Logging](#monitoring-and-logging)
6. [Security Issues](#security-issues)
7. [Database and Storage](#database-and-storage)
8. [Debug Commands](#debug-commands)

## Deployment Issues

### Kubernetes Pod Failures

**Symptoms:**
- Pods stuck in `Pending`, `CrashLoopBackOff`, or `Error` status
- Container restart loops

**Diagnosis:**
```bash
# Check pod status
kubectl get pods -o wide

# Check pod events
kubectl describe pod <pod-name>

# Check container logs
kubectl logs <pod-name> --previous

# Check resource usage
kubectl top pods
```

**Common Solutions:**

#### 1. Image Pull Errors
```bash
# Check if image exists
gcloud container images list --repository=gcr.io/<project-id>

# Verify image pull secrets
kubectl get secrets

# Check image pull policy
kubectl describe pod <pod-name> | grep Image
```

#### 2. Resource Constraints
```yaml
# Update resource limits in deployment
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

#### 3. Configuration Errors
```bash
# Validate ConfigMaps
kubectl describe configmap <config-name>

# Check environment variables
kubectl exec <pod-name> -- env

# Validate secrets
kubectl describe secret <secret-name>
```

### Service Discovery Issues

**Symptoms:**
- Services cannot communicate with each other
- DNS resolution failures

**Diagnosis:**
```bash
# Check service endpoints
kubectl get endpoints

# Test DNS resolution
kubectl exec <pod-name> -- nslookup <service-name>

# Check service configuration
kubectl describe service <service-name>
```

**Solutions:**
```bash
# Restart DNS pods
kubectl delete pod -l k8s-app=kube-dns -n kube-system

# Check network policies
kubectl get networkpolicies

# Verify service selectors
kubectl describe service <service-name>
```

## Service Communication Problems

### MCP Gateway Issues

**Symptoms:**
- Requests to microservices failing
- Gateway returning 502/503 errors

**Diagnosis:**
```bash
# Check gateway logs
kubectl logs deployment/mcp-gateway

# Test gateway health
curl http://mcp-gateway:8080/health

# Check downstream services
kubectl get pods -l app=user-service
```

**Solutions:**

#### 1. Circuit Breaker Activation
```bash
# Check circuit breaker status
kubectl exec deployment/mcp-gateway -- curl http://localhost:8080/metrics

# Reset circuit breaker (if implemented)
kubectl delete pod -l app=mcp-gateway
```

#### 2. Service Registration
```yaml
# Verify service registration in ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-gateway-config
data:
  services.json: |
    {
      "user-service": "http://user-service:8080",
      "transaction-service": "http://transaction-service:8080"
    }
```

### A2A Communication Failures

**Symptoms:**
- Agents cannot communicate with each other
- WebSocket connection errors

**Diagnosis:**
```bash
# Check A2A hub logs
kubectl logs deployment/a2a-hub

# Test WebSocket connection
kubectl exec <pod-name> -- nc -zv a2a-hub 8081

# Check agent registrations
kubectl exec deployment/a2a-hub -- curl http://localhost:8081/agents
```

**Solutions:**

#### 1. WebSocket Connection Issues
```bash
# Check firewall rules
gcloud compute firewall-rules list

# Verify service mesh configuration
kubectl get servicemeshmembers

# Test direct connection
kubectl port-forward svc/a2a-hub 8081:8081
```

#### 2. Message Delivery Problems
```bash
# Check message queues
kubectl exec deployment/a2a-hub -- curl http://localhost:8081/metrics

# Verify agent registrations
kubectl exec deployment/a2a-hub -- curl http://localhost:8081/agents

# Check message persistence
kubectl exec deployment/a2a-hub -- ls /app/messages/
```

## Agent-Specific Issues

### Chatbot Agent Problems

**Symptoms:**
- Intent classification failures
- Conversation state issues
- Session timeout errors

**Diagnosis:**
```bash
# Check chatbot logs
kubectl logs deployment/chatbot-agent

# Test intent classification
curl -X POST http://chatbot-agent:8080/api/chatbot/process \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","userId":"test","message":"hello"}'

# Check session storage
kubectl exec deployment/chatbot-agent -- redis-cli keys "session:*"
```

**Solutions:**

#### 1. Gemini API Issues
```bash
# Check API key validity
kubectl get secret gemini-secret

# Test Gemini API directly
curl -H "Authorization: Bearer $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent

# Check rate limits
kubectl exec deployment/chatbot-agent -- curl http://localhost:8080/metrics
```

#### 2. Session Management
```yaml
# Update session configuration
env:
  - name: SESSION_TIMEOUT
    value: "1800000"  # 30 minutes
  - name: MAX_HISTORY_LENGTH
    value: "50"
  - name: REDIS_URL
    value: "redis://redis:6379"
```

### Fraud Detection Agent Issues

**Symptoms:**
- Risk assessment failures
- High false positive/negative rates
- Transaction analysis timeouts

**Diagnosis:**
```bash
# Check fraud detection logs
kubectl logs deployment/fraud-detection-agent

# Test risk assessment
curl -X POST http://fraud-detection-agent:8080/api/fraud-detection/analyze \
  -H "Content-Type: application/json" \
  -d '{"transactionId":"test","userId":"test","amount":100.00}'

# Check model performance
kubectl exec deployment/fraud-detection-agent -- curl http://localhost:8080/metrics
```

**Solutions:**

#### 1. Model Accuracy Issues
```yaml
# Update risk thresholds
env:
  - name: RISK_THRESHOLD_HIGH
    value: "0.8"
  - name: RISK_THRESHOLD_CRITICAL
    value: "0.95"
  - name: MIN_CONFIDENCE_SCORE
    value: "0.7"
```

#### 2. Performance Optimization
```yaml
# Add resource limits
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

### Recommendation Agent Problems

**Symptoms:**
- Poor recommendation quality
- Caching issues
- High latency

**Diagnosis:**
```bash
# Check recommendation logs
kubectl logs deployment/recommendation-agent

# Test recommendation generation
curl -X POST http://recommendation-agent:8080/api/recommendation/generate \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","limit":5}'

# Check cache hit rate
kubectl exec deployment/recommendation-agent -- curl http://localhost:8080/metrics
```

**Solutions:**

#### 1. Cache Configuration
```yaml
env:
  - name: CACHE_TTL
    value: "3600000"  # 1 hour
  - name: CACHE_MAX_SIZE
    value: "10000"
  - name: REDIS_URL
    value: "redis://redis:6379"
```

#### 2. Algorithm Tuning
```yaml
env:
  - name: COLLABORATIVE_WEIGHT
    value: "0.6"
  - name: CONTENT_BASED_WEIGHT
    value: "0.4"
  - name: MIN_SIMILARITY_SCORE
    value: "0.3"
```

## Performance Problems

### High CPU Usage

**Symptoms:**
- Pod CPU usage > 80%
- Request timeouts
- Service degradation

**Diagnosis:**
```bash
# Check CPU usage
kubectl top pods

# Profile application
kubectl exec <pod-name> -- node --prof-process > profile.cpuprofile

# Check thread count
kubectl exec <pod-name> -- ps aux
```

**Solutions:**

#### 1. Horizontal Scaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent
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

#### 2. Resource Optimization
```yaml
resources:
  requests:
    cpu: "500m"
    memory: "1Gi"
  limits:
    cpu: "1000m"
    memory: "2Gi"
```

### High Memory Usage

**Symptoms:**
- Pod memory usage > 80%
- OOM kills
- Service restarts

**Diagnosis:**
```bash
# Check memory usage
kubectl top pods

# Check for memory leaks
kubectl exec <pod-name> -- node --expose-gc --inspect

# Analyze heap dumps
kubectl exec <pod-name> -- node --heap-prof > heap.heapprofile
```

**Solutions:**

#### 1. Memory Limits
```yaml
resources:
  requests:
    memory: "512Mi"
  limits:
    memory: "1Gi"
```

#### 2. Garbage Collection Tuning
```yaml
env:
  - name: NODE_OPTIONS
    value: "--max-old-space-size=512 --optimize-for-size"
```

### Slow Response Times

**Symptoms:**
- API response time > 2 seconds
- Client timeouts
- User complaints

**Diagnosis:**
```bash
# Check response times
kubectl exec deployment/prometheus -- promql 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))'

# Profile slow requests
kubectl logs deployment/agent | grep "slow"

# Check database query performance
kubectl exec deployment/agent -- curl http://localhost:8080/debug/queries
```

**Solutions:**

#### 1. Database Optimization
```sql
-- Add indexes
CREATE INDEX idx_transactions_user_id_timestamp ON transactions(user_id, created_at);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity);

-- Optimize queries
EXPLAIN ANALYZE SELECT * FROM transactions WHERE user_id = $1 AND created_at > $2;
```

#### 2. Caching Strategy
```yaml
env:
  - name: CACHE_STRATEGY
    value: "redis"
  - name: CACHE_TTL
    value: "300"
  - name: CACHE_MAX_MEMORY
    value: "512mb"
```

## Monitoring and Logging

### Log Analysis

**Common Log Patterns:**
```bash
# Search for errors
kubectl logs deployment/agent | grep "ERROR"

# Find slow requests
kubectl logs deployment/agent | grep "processingTime.*[0-9]\{4,\}"

# Check for memory issues
kubectl logs deployment/agent | grep "heap"

# Monitor rate limits
kubectl logs deployment/agent | grep "rate.limit"
```

### Metrics Analysis

**Key Metrics to Monitor:**
```bash
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Response time percentiles
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Resource usage
rate(container_cpu_usage_seconds_total[5m])
rate(container_memory_usage_bytes[5m])
```

### Alert Configuration

**Recommended Alerts:**
```yaml
# High error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
  for: 5m
  labels:
    severity: warning

# Slow response time
- alert: SlowResponseTime
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
  for: 5m
  labels:
    severity: warning

# High resource usage
- alert: HighCPUUsage
  expr: rate(container_cpu_usage_seconds_total[5m]) > 0.8
  for: 5m
  labels:
    severity: warning
```

## Security Issues

### Authentication Failures

**Symptoms:**
- 401 Unauthorized errors
- Service access denied

**Diagnosis:**
```bash
# Check authentication logs
kubectl logs deployment/auth-service

# Verify API keys
kubectl get secrets

# Test authentication
curl -H "Authorization: Bearer <token>" http://service:8080/api/test
```

**Solutions:**

#### 1. API Key Rotation
```bash
# Update Gemini API key
kubectl create secret generic gemini-secret \
  --from-literal=api-key=new-api-key \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart affected pods
kubectl rollout restart deployment/agent
```

#### 2. Token Validation
```yaml
env:
  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: jwt-secret
        key: secret
```

### Authorization Issues

**Symptoms:**
- 403 Forbidden errors
- Insufficient permissions

**Diagnosis:**
```bash
# Check RBAC configuration
kubectl get clusterrolebindings

# Verify service account permissions
kubectl describe serviceaccount agent-sa

# Test authorization
curl -H "Authorization: Bearer <token>" \
     -H "X-User-Role: admin" \
     http://service:8080/api/admin
```

## Database and Storage

### Connection Issues

**Symptoms:**
- Database connection timeouts
- Query failures

**Diagnosis:**
```bash
# Check database connectivity
kubectl exec deployment/agent -- nc -zv database 5432

# Test database queries
kubectl exec deployment/agent -- psql -h database -U user -d db -c "SELECT 1"

# Check connection pool
kubectl exec deployment/agent -- curl http://localhost:8080/debug/db-pool
```

**Solutions:**

#### 1. Connection Pool Configuration
```yaml
env:
  - name: DB_POOL_MIN
    value: "2"
  - name: DB_POOL_MAX
    value: "20"
  - name: DB_POOL_IDLE_TIMEOUT
    value: "30000"
```

#### 2. Database Optimization
```sql
-- Connection settings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET work_mem = '4MB';

-- Query optimization
CREATE INDEX CONCURRENTLY idx_transactions_composite ON transactions(user_id, status, created_at);
```

### Storage Issues

**Symptoms:**
- Disk space warnings
- File system errors

**Diagnosis:**
```bash
# Check disk usage
kubectl exec <pod-name> -- df -h

# Check persistent volume status
kubectl get pv

# Monitor storage usage
kubectl describe pvc <pvc-name>
```

**Solutions:**

#### 1. Storage Expansion
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: agent-storage
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi  # Increased from 10Gi
```

#### 2. Log Rotation
```yaml
env:
  - name: LOG_MAX_SIZE
    value: "100m"
  - name: LOG_MAX_FILES
    value: "5"
  - name: LOG_LEVEL
    value: "info"
```

## Debug Commands

### General Debugging

```bash
# Get cluster status
kubectl get all --all-namespaces

# Check node status
kubectl get nodes -o wide

# View events
kubectl get events --sort-by=.metadata.creationTimestamp

# Debug DNS
kubectl run debug --image=busybox --rm -it -- nslookup service-name
```

### Network Debugging

```bash
# Test connectivity
kubectl run debug --image=busybox --rm -it -- ping service-name

# Check network policies
kubectl get networkpolicies

# Debug service mesh
kubectl get servicemeshmembers

# Port forwarding for testing
kubectl port-forward svc/service-name 8080:8080
```

### Application Debugging

```bash
# Get pod logs
kubectl logs <pod-name> --tail=100 --follow

# Execute commands in pod
kubectl exec -it <pod-name> -- /bin/bash

# Copy files from pod
kubectl cp <pod-name>:/app/logs/error.log ./error.log

# Debug with ephemeral container
kubectl debug <pod-name> --image=busybox --target=<container-name>
```

### Performance Debugging

```bash
# CPU profiling
kubectl exec <pod-name> -- node --prof --logfile=/tmp/profile.log app.js

# Memory profiling
kubectl exec <pod-name> -- node --heap-prof --logfile=/tmp/heap.log app.js

# Network tracing
kubectl exec <pod-name> -- tcpdump -i eth0 -w /tmp/trace.pcap

# Database query analysis
kubectl exec <pod-name> -- curl http://localhost:8080/debug/queries
```

---

**Troubleshooting Guide Complete** 🔧

This comprehensive troubleshooting guide covers diagnosis and resolution of common issues in the Agentic Microservices system. For additional support, check the monitoring dashboards or contact the development team.