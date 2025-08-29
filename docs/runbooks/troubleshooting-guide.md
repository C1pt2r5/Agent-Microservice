# Agentic Microservices Troubleshooting Guide

## Table of Contents

1. [General Troubleshooting Approach](#general-troubleshooting-approach)
2. [Common Issues and Solutions](#common-issues-and-solutions)
3. [Agent-Specific Issues](#agent-specific-issues)
4. [Infrastructure Issues](#infrastructure-issues)
5. [Performance Issues](#performance-issues)
6. [Network and Connectivity Issues](#network-and-connectivity-issues)
7. [Configuration Issues](#configuration-issues)
8. [External Dependencies Issues](#external-dependencies-issues)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Advanced Troubleshooting](#advanced-troubleshooting)

## General Troubleshooting Approach

### Step-by-Step Methodology

1. **Identify the Problem**
   - What is the exact error or symptom?
   - When did it start occurring?
   - What changed recently?

2. **Gather Information**
   - Check monitoring dashboards
   - Review logs and metrics
   - Verify system status

3. **Isolate the Issue**
   - Determine affected components
   - Test individual services
   - Check dependencies

4. **Implement Solution**
   - Apply fix or workaround
   - Verify resolution
   - Monitor for stability

5. **Document and Follow-up**
   - Record solution in knowledge base
   - Update monitoring if needed
   - Implement preventive measures

### Essential Troubleshooting Commands

```powershell
# System Overview
kubectl get pods -n agentic-prod -o wide
kubectl get services -n agentic-prod
kubectl get nodes
kubectl cluster-info

# Resource Usage
kubectl top nodes
kubectl top pods -n agentic-prod

# Events and Logs
kubectl get events -n agentic-prod --sort-by='.lastTimestamp'
kubectl logs -f deployment/<service-name> -n agentic-prod
kubectl describe pod <pod-name> -n agentic-prod

# Configuration
kubectl get configmaps -n agentic-prod
kubectl get secrets -n agentic-prod
kubectl describe deployment <service-name> -n agentic-prod
```

## Common Issues and Solutions

### Issue: Pods Stuck in Pending State

**Symptoms:**

- Pods show status "Pending"
- Services are not available
- New deployments fail to start

**Diagnosis:**

```powershell
kubectl describe pod <pod-name> -n agentic-prod
kubectl get events -n agentic-prod | grep -i pending
kubectl top nodes
```

**Common Causes and Solutions:**

1. **Insufficient Resources**

   ```powershell
   # Check node capacity
   kubectl describe nodes
   
   # Solution: Scale cluster or reduce resource requests
   gcloud container clusters resize agentic-prod-cluster --num-nodes=<count>
   ```

2. **Node Selector Issues**

   ```powershell
   # Check node labels
   kubectl get nodes --show-labels
   
   # Solution: Update node selectors or add labels to nodes
   kubectl label nodes <node-name> <key>=<value>
   ```

3. **PVC Mount Issues**

   ```powershell
   # Check PVC status
   kubectl get pvc -n agentic-prod
   
   # Solution: Ensure storage class exists and has capacity
   kubectl get storageclass
   ```

### Issue: Pods Crashing (CrashLoopBackOff)

**Symptoms:**

- Pods restart repeatedly
- Status shows "CrashLoopBackOff"
- Service endpoints are unavailable

**Diagnosis:**

```powershell
kubectl logs <pod-name> -n agentic-prod --previous
kubectl describe pod <pod-name> -n agentic-prod
kubectl get events -n agentic-prod | grep -i crash
```

**Common Causes and Solutions:**

1. **Application Errors**

   ```powershell
   # Check application logs
   kubectl logs -f deployment/<service-name> -n agentic-prod
   
   # Solution: Fix application code or configuration
   # Check for missing environment variables or config files
   ```

2. **Health Check Failures**

   ```powershell
   # Test health check endpoint
   kubectl port-forward pod/<pod-name> 8080:8080 -n agentic-prod
   curl http://localhost:8080/health
   
   # Solution: Fix health check endpoint or adjust probe settings
   ```

3. **Resource Limits**

   ```powershell
   # Check resource usage
   kubectl top pod <pod-name> -n agentic-prod
   
   # Solution: Increase memory/CPU limits in deployment
   ```

### Issue: Service Not Accessible

**Symptoms:**

- HTTP 503 or connection refused errors
- Service endpoints return no results
- External traffic cannot reach services

**Diagnosis:**

```powershell
kubectl get services -n agentic-prod
kubectl get endpoints -n agentic-prod
kubectl describe service <service-name> -n agentic-prod
```

**Common Causes and Solutions:**

1. **No Healthy Pods**

   ```powershell
   # Check pod status
   kubectl get pods -l app=<service-name> -n agentic-prod
   
   # Solution: Fix pod issues (see CrashLoopBackOff section)
   ```

2. **Service Selector Mismatch**

   ```powershell
   # Check service selector
   kubectl describe service <service-name> -n agentic-prod
   kubectl get pods --show-labels -n agentic-prod
   
   # Solution: Update service selector to match pod labels
   ```

3. **Ingress Configuration Issues**

   ```powershell
   # Check ingress status
   kubectl get ingress -n agentic-prod
   kubectl describe ingress <ingress-name> -n agentic-prod
   
   # Solution: Verify ingress controller and SSL certificates
   ```

## Agent-Specific Issues

### Chatbot Agent Issues

#### Issue: Chatbot Not Responding to Messages

**Symptoms:**

- Chat interface shows loading indefinitely
- HTTP timeouts on chat endpoints
- No responses generated

**Diagnosis:**

```powershell
# Check chatbot logs
kubectl logs -f deployment/chatbot-agent -n agentic-prod | grep -i error

# Test chatbot endpoint
kubectl port-forward service/chatbot-agent 8082:8082 -n agentic-prod
curl -X POST http://localhost:8082/api/chat -d '{"message":"test"}'

# Check Gemini AI connectivity
kubectl logs -f deployment/chatbot-agent -n agentic-prod | grep -i gemini
```

**Solutions:**

1. **Gemini AI API Issues**

   ```powershell
   # Check API key configuration
   kubectl get secret gemini-api-key -n agentic-prod -o yaml
   
   # Verify API quota
   # Check Google Cloud Console for API usage
   
   # Solution: Renew API key or increase quota
   ```

2. **MCP Gateway Connectivity**

   ```powershell
   # Test MCP Gateway
   kubectl port-forward service/mcp-gateway 8080:8080 -n agentic-prod
   curl http://localhost:8080/health
   
   # Solution: Fix MCP Gateway issues (see Infrastructure section)
   ```

3. **Memory Issues**

   ```powershell
   # Check memory usage
   kubectl top pod -l app=chatbot-agent -n agentic-prod
   
   # Solution: Increase memory limits or optimize application
   ```

#### Issue: Chatbot Giving Incorrect Responses

**Symptoms:**

- Responses don't match user queries
- Inconsistent or nonsensical answers
- High error rate in conversation flow

**Diagnosis:**

```powershell
# Check conversation logs
kubectl logs -f deployment/chatbot-agent -n agentic-prod | grep -i conversation

# Review Gemini AI model responses
# Check Jaeger traces for conversation flow
```

**Solutions:**

1. **Model Configuration Issues**

   ```powershell
   # Check model parameters
   kubectl get configmap chatbot-agent-config -n agentic-prod -o yaml
   
   # Solution: Adjust temperature, max_tokens, or model version
   ```

2. **Context Management Issues**

   ```powershell
   # Check conversation state storage
   kubectl logs -f deployment/chatbot-agent -n agentic-prod | grep -i context
   
   # Solution: Clear conversation cache or fix state management
   ```

### Fraud Detection Agent Issues

#### Issue: High False Positive Rate

**Symptoms:**

- Legitimate transactions being flagged as fraud
- Customer complaints about blocked transactions
- High alert volume

**Diagnosis:**

```powershell
# Check fraud detection logs
kubectl logs -f deployment/fraud-detection-agent -n agentic-prod | grep -i fraud

# Review fraud detection metrics in Grafana
# Analyze recent transaction patterns
```

**Solutions:**

1. **Threshold Adjustment**

   ```powershell
   # Check current thresholds
   kubectl get configmap fraud-detection-config -n agentic-prod -o yaml
   
   # Solution: Adjust fraud_threshold value
   kubectl patch configmap fraud-detection-config -n agentic-prod --patch '{"data":{"FRAUD_THRESHOLD":"0.9"}}'
   kubectl rollout restart deployment/fraud-detection-agent -n agentic-prod
   ```

2. **Model Retraining**

   ```powershell
   # Check model version and performance
   kubectl logs -f deployment/fraud-detection-agent -n agentic-prod | grep -i model
   
   # Solution: Update model or retrain with recent data
   ```

#### Issue: Fraud Detection Not Processing Transactions

**Symptoms:**

- No fraud alerts being generated
- Transaction processing appears normal but no analysis
- Fraud detection metrics show zero activity

**Diagnosis:**

```powershell
# Check event stream connectivity
kubectl logs -f deployment/fraud-detection-agent -n agentic-prod | grep -i stream

# Check A2A Hub connectivity
kubectl port-forward service/a2a-hub 8081:8081 -n agentic-prod
curl http://localhost:8081/health
```

**Solutions:**

1. **Event Stream Issues**

   ```powershell
   # Check event consumer configuration
   kubectl get configmap fraud-detection-config -n agentic-prod -o yaml
   
   # Solution: Verify event stream endpoints and credentials
   ```

2. **A2A Communication Issues**

   ```powershell
   # Test A2A connectivity
   kubectl logs -f deployment/a2a-hub -n agentic-prod | grep -i fraud
   
   # Solution: Fix A2A Hub issues (see Infrastructure section)
   ```

### Recommendation Agent Issues

#### Issue: No Recommendations Generated

**Symptoms:**

- Empty recommendation responses
- Recommendation API returns null or empty arrays
- Users see "No recommendations available" messages

**Diagnosis:**

```powershell
# Check recommendation logs
kubectl logs -f deployment/recommendation-agent -n agentic-prod | grep -i recommendation

# Test recommendation endpoint
kubectl port-forward service/recommendation-agent 8085:8085 -n agentic-prod
curl http://localhost:8085/api/recommendations/user123
```

**Solutions:**

1. **Data Access Issues**

   ```powershell
   # Check MCP connectivity for user/product data
   kubectl logs -f deployment/recommendation-agent -n agentic-prod | grep -i mcp
   
   # Solution: Fix MCP Gateway connectivity
   ```

2. **Cache Issues**

   ```powershell
   # Check Redis connectivity
   kubectl logs -f deployment/recommendation-agent -n agentic-prod | grep -i redis
   
   # Clear recommendation cache
   kubectl exec -it deployment/redis -n agentic-prod -- redis-cli FLUSHDB
   ```

3. **Algorithm Issues**

   ```powershell
   # Check algorithm configuration
   kubectl get configmap recommendation-config -n agentic-prod -o yaml
   
   # Solution: Verify algorithm parameters and data requirements
   ```

## Infrastructure Issues

### MCP Gateway Issues

#### Issue: MCP Gateway Not Routing Requests

**Symptoms:**

- 502 Bad Gateway errors
- Requests timing out
- Service discovery failures

**Diagnosis:**

```powershell
# Check MCP Gateway status
kubectl get pods -l app=mcp-gateway -n agentic-prod
kubectl logs -f deployment/mcp-gateway -n agentic-prod

# Test gateway endpoints
kubectl port-forward service/mcp-gateway 8080:8080 -n agentic-prod
curl http://localhost:8080/health
```

**Solutions:**

1. **Service Discovery Issues**

   ```powershell
   # Check service configuration
   kubectl get configmap mcp-gateway-config -n agentic-prod -o yaml
   
   # Verify external service endpoints
   curl -I <external-service-endpoint>
   
   # Solution: Update service endpoints or fix DNS resolution
   ```

2. **Authentication Issues**

   ```powershell
   # Check authentication tokens
   kubectl get secret mcp-service-tokens -n agentic-prod -o yaml
   
   # Solution: Renew expired tokens or fix authentication configuration
   ```

3. **Circuit Breaker Activation**

   ```powershell
   # Check circuit breaker status
   kubectl logs -f deployment/mcp-gateway -n agentic-prod | grep -i circuit
   
   # Solution: Reset circuit breaker or fix underlying service issues
   ```

### A2A Hub Issues

#### Issue: Agent-to-Agent Messages Not Delivered

**Symptoms:**

- Agents not receiving messages from other agents
- Message queue backlog growing
- Inter-agent communication failures

**Diagnosis:**

```powershell
# Check A2A Hub status
kubectl get pods -l app=a2a-hub -n agentic-prod
kubectl logs -f deployment/a2a-hub -n agentic-prod

# Check message queue status
kubectl port-forward service/a2a-hub 8081:8081 -n agentic-prod
curl http://localhost:8081/api/status
```

**Solutions:**

1. **Message Queue Issues**

   ```powershell
   # Check Redis connectivity
   kubectl logs -f deployment/a2a-hub -n agentic-prod | grep -i redis
   
   # Check Redis status
   kubectl exec -it deployment/redis -n agentic-prod -- redis-cli ping
   
   # Solution: Fix Redis connectivity or clear stuck messages
   ```

2. **Agent Registration Issues**

   ```powershell
   # Check registered agents
   curl http://localhost:8081/api/agents
   
   # Solution: Restart agents to re-register or fix registration logic
   ```

## Performance Issues

### Issue: High Response Times

**Symptoms:**

- API responses taking > 2 seconds
- User interface feels slow
- Timeout errors occurring

**Diagnosis:**

```powershell
# Check response time metrics in Grafana
# Review Jaeger traces for slow requests
# Check resource utilization
kubectl top pods -n agentic-prod
```

**Solutions:**

1. **Resource Constraints**

   ```powershell
   # Scale up services
   kubectl scale deployment <service-name> --replicas=<count> -n agentic-prod
   
   # Increase resource limits
   # Edit deployment manifests and apply
   ```

2. **Database/Cache Performance**

   ```powershell
   # Check Redis performance
   kubectl exec -it deployment/redis -n agentic-prod -- redis-cli info stats
   
   # Solution: Optimize queries or increase cache size
   ```

3. **External API Latency**

   ```powershell
   # Check external API response times
   kubectl logs -f deployment/<service-name> -n agentic-prod | grep -i latency
   
   # Solution: Implement caching or use different API endpoints
   ```

### Issue: High Memory Usage

**Symptoms:**

- Pods being killed due to OOMKilled
- Memory usage consistently above 80%
- Performance degradation over time

**Diagnosis:**

```powershell
# Check memory usage
kubectl top pods -n agentic-prod
kubectl describe pod <pod-name> -n agentic-prod | grep -i memory

# Check for memory leaks
kubectl logs -f deployment/<service-name> -n agentic-prod | grep -i memory
```

**Solutions:**

1. **Memory Leaks**

   ```powershell
   # Restart affected services
   kubectl rollout restart deployment/<service-name> -n agentic-prod
   
   # Solution: Fix memory leaks in application code
   ```

2. **Insufficient Memory Limits**

   ```powershell
   # Increase memory limits
   # Edit deployment manifests:
   # resources:
   #   limits:
   #     memory: "2Gi"
   ```

## Network and Connectivity Issues

### Issue: DNS Resolution Failures

**Symptoms:**

- Services cannot connect to each other
- External API calls failing with DNS errors
- Intermittent connectivity issues

**Diagnosis:**

```powershell
# Test DNS resolution from pod
kubectl exec -it <pod-name> -n agentic-prod -- nslookup <service-name>
kubectl exec -it <pod-name> -n agentic-prod -- nslookup google.com

# Check DNS configuration
kubectl get configmap coredns -n kube-system -o yaml
```

**Solutions:**

1. **CoreDNS Issues**

   ```powershell
   # Restart CoreDNS
   kubectl rollout restart deployment/coredns -n kube-system
   
   # Check CoreDNS logs
   kubectl logs -f deployment/coredns -n kube-system
   ```

2. **Network Policy Issues**

   ```powershell
   # Check network policies
   kubectl get networkpolicies -n agentic-prod
   
   # Solution: Update network policies to allow required traffic
   ```

### Issue: SSL/TLS Certificate Problems

**Symptoms:**

- HTTPS endpoints returning certificate errors
- SSL handshake failures
- Browser security warnings

**Diagnosis:**

```powershell
# Check certificate status
kubectl get certificates -n agentic-prod
kubectl describe certificate <cert-name> -n agentic-prod

# Test certificate
openssl s_client -connect <domain>:443 -servername <domain>
```

**Solutions:**

1. **Certificate Expiration**

   ```powershell
   # Renew certificate
   kubectl annotate certificate <cert-name> cert-manager.io/issue-temporary-certificate="true" -n agentic-prod
   
   # Check cert-manager logs
   kubectl logs -f deployment/cert-manager -n cert-manager
   ```

2. **Certificate Configuration**

   ```powershell
   # Check ingress TLS configuration
   kubectl get ingress -n agentic-prod -o yaml
   
   # Solution: Update ingress TLS settings
   ```

## Configuration Issues

### Issue: Environment Variables Not Loading

**Symptoms:**

- Applications using default values instead of configured values
- Configuration-dependent features not working
- Startup errors related to missing configuration

**Diagnosis:**

```powershell
# Check ConfigMap contents
kubectl get configmap <config-name> -n agentic-prod -o yaml

# Check environment variables in pod
kubectl exec -it <pod-name> -n agentic-prod -- env | grep -i <variable-name>

# Check deployment configuration
kubectl describe deployment <service-name> -n agentic-prod
```

**Solutions:**

1. **ConfigMap Not Mounted**

   ```powershell
   # Check deployment volume mounts
   kubectl describe deployment <service-name> -n agentic-prod | grep -A 10 -i volume
   
   # Solution: Add ConfigMap volume mount to deployment
   ```

2. **Incorrect ConfigMap Reference**

   ```powershell
   # Verify ConfigMap name in deployment
   kubectl get deployment <service-name> -n agentic-prod -o yaml | grep -i configmap
   
   # Solution: Update deployment to reference correct ConfigMap
   ```

### Issue: Secret Values Not Available

**Symptoms:**

- Authentication failures
- API key errors
- Database connection failures

**Diagnosis:**

```powershell
# Check Secret existence
kubectl get secrets -n agentic-prod
kubectl describe secret <secret-name> -n agentic-prod

# Check Secret mounting in pod
kubectl describe pod <pod-name> -n agentic-prod | grep -A 5 -i secret
```

**Solutions:**

1. **Secret Not Created**

   ```powershell
   # Create missing secret
   kubectl create secret generic <secret-name> --from-literal=<key>=<value> -n agentic-prod
   
   # Or apply from configuration
   ./scripts/config-deploy.ps1 -Environment production
   ```

2. **Secret Not Mounted**

   ```powershell
   # Check deployment secret references
   kubectl get deployment <service-name> -n agentic-prod -o yaml | grep -A 5 -i secret
   
   # Solution: Add secret volume mount to deployment
   ```

## External Dependencies Issues

### Issue: Gemini AI API Failures

**Symptoms:**

- AI-powered features not working
- Rate limit errors
- Authentication failures with Gemini API

**Diagnosis:**

```powershell
# Check Gemini API logs
kubectl logs -f deployment/<agent-name> -n agentic-prod | grep -i gemini

# Test API connectivity
kubectl exec -it <pod-name> -n agentic-prod -- curl -H "Authorization: Bearer <api-key>" https://generativelanguage.googleapis.com/v1beta/models
```

**Solutions:**

1. **API Key Issues**

   ```powershell
   # Check API key secret
   kubectl get secret gemini-api-key -n agentic-prod -o yaml
   
   # Update API key
   kubectl patch secret gemini-api-key -n agentic-prod --patch '{"data":{"api-key":"<base64-encoded-key>"}}'
   ```

2. **Rate Limiting**

   ```powershell
   # Check rate limit configuration
   kubectl get configmap <agent-config> -n agentic-prod -o yaml | grep -i rate
   
   # Solution: Implement request queuing or increase quotas
   ```

3. **Model Availability**

   ```powershell
   # Check model configuration
   kubectl logs -f deployment/<agent-name> -n agentic-prod | grep -i model
   
   # Solution: Switch to available model or check Google Cloud Console
   ```

### Issue: Redis Connectivity Problems

**Symptoms:**

- Cache misses increasing
- Session data not persisting
- Connection timeout errors

**Diagnosis:**

```powershell
# Check Redis pod status
kubectl get pods -l app=redis -n agentic-prod

# Test Redis connectivity
kubectl exec -it deployment/redis -n agentic-prod -- redis-cli ping

# Check Redis logs
kubectl logs -f deployment/redis -n agentic-prod
```

**Solutions:**

1. **Redis Pod Issues**

   ```powershell
   # Restart Redis
   kubectl rollout restart deployment/redis -n agentic-prod
   
   # Check Redis configuration
   kubectl get configmap redis-config -n agentic-prod -o yaml
   ```

2. **Connection Pool Issues**

   ```powershell
   # Check connection pool configuration
   kubectl logs -f deployment/<service-name> -n agentic-prod | grep -i redis
   
   # Solution: Adjust connection pool settings
   ```

## Monitoring and Logging

### Issue: Metrics Not Appearing in Grafana

**Symptoms:**

- Empty or missing graphs in dashboards
- "No data" messages in Grafana panels
- Metrics not being collected

**Diagnosis:**

```powershell
# Check Prometheus targets
kubectl port-forward service/prometheus-server 9090:9090 -n monitoring
# Visit http://localhost:9090/targets

# Check service annotations
kubectl get services -n agentic-prod -o yaml | grep -A 5 -i prometheus

# Check Prometheus configuration
kubectl get configmap prometheus-server -n monitoring -o yaml
```

**Solutions:**

1. **Missing Prometheus Annotations**

   ```powershell
   # Add annotations to service
   kubectl annotate service <service-name> prometheus.io/scrape=true -n agentic-prod
   kubectl annotate service <service-name> prometheus.io/port=8080 -n agentic-prod
   kubectl annotate service <service-name> prometheus.io/path=/metrics -n agentic-prod
   ```

2. **Metrics Endpoint Issues**

   ```powershell
   # Test metrics endpoint
   kubectl port-forward service/<service-name> 8080:8080 -n agentic-prod
   curl http://localhost:8080/metrics
   
   # Solution: Fix metrics endpoint in application
   ```

### Issue: Logs Not Appearing in Centralized Logging

**Symptoms:**

- Missing log entries in log aggregation system
- Incomplete log data
- Log parsing errors

**Diagnosis:**

```powershell
# Check pod logs directly
kubectl logs -f deployment/<service-name> -n agentic-prod

# Check log format
kubectl logs deployment/<service-name> -n agentic-prod --tail=10

# Check logging configuration
kubectl get configmap <service-config> -n agentic-prod -o yaml | grep -i log
```

**Solutions:**

1. **Log Format Issues**

   ```powershell
   # Update log format configuration
   kubectl patch configmap <service-config> -n agentic-prod --patch '{"data":{"LOG_FORMAT":"json"}}'
   kubectl rollout restart deployment/<service-name> -n agentic-prod
   ```

2. **Log Level Issues**

   ```powershell
   # Adjust log level
   kubectl patch configmap <service-config> -n agentic-prod --patch '{"data":{"LOG_LEVEL":"info"}}'
   kubectl rollout restart deployment/<service-name> -n agentic-prod
   ```

## Advanced Troubleshooting

### Using Jaeger for Distributed Tracing

```powershell
# Access Jaeger UI
kubectl port-forward service/jaeger-query 16686:16686 -n monitoring

# Search for traces by service
# Look for high latency or error traces
# Analyze trace spans for bottlenecks
```

### Debugging with kubectl exec

```powershell
# Access pod shell
kubectl exec -it <pod-name> -n agentic-prod -- /bin/bash

# Test network connectivity
kubectl exec -it <pod-name> -n agentic-prod -- curl <service-url>

# Check file system
kubectl exec -it <pod-name> -n agentic-prod -- ls -la /app/config

# Check processes
kubectl exec -it <pod-name> -n agentic-prod -- ps aux
```

### Performance Profiling

```powershell
# CPU profiling
kubectl exec -it <pod-name> -n agentic-prod -- curl http://localhost:8080/debug/pprof/profile

# Memory profiling
kubectl exec -it <pod-name> -n agentic-prod -- curl http://localhost:8080/debug/pprof/heap

# Goroutine analysis (for Go applications)
kubectl exec -it <pod-name> -n agentic-prod -- curl http://localhost:8080/debug/pprof/goroutine
```

### Emergency Debugging Commands

```powershell
# Quick system overview
kubectl get all -n agentic-prod

# Check all events
kubectl get events --all-namespaces --sort-by='.lastTimestamp'

# Resource usage across all pods
kubectl top pods --all-namespaces

# Network connectivity test
kubectl run debug-pod --image=nicolaka/netshoot -it --rm -- /bin/bash

# DNS debugging
kubectl run debug-dns --image=busybox -it --rm -- nslookup kubernetes.default
```

---

## Quick Reference

### Common Error Patterns

| Error Pattern | Likely Cause | Quick Fix |
|---------------|--------------|-----------|
| `ImagePullBackOff` | Image not found or registry issues | Check image name and registry access |
| `CrashLoopBackOff` | Application startup failure | Check logs and resource limits |
| `Pending` | Resource constraints | Scale cluster or reduce requests |
| `503 Service Unavailable` | No healthy pods | Check pod status and health checks |
| `Connection refused` | Service not listening | Verify port configuration |
| `DNS resolution failed` | Network/DNS issues | Check CoreDNS and network policies |

### Emergency Contacts

- **On-Call Engineer**: [Contact Information]
- **Platform Team**: [Contact Information]
- **Development Team**: [Contact Information]

### Useful Links

- **Monitoring Dashboards**: [Grafana URL]
- **Log Aggregation**: [Logging System URL]
- **Documentation**: [Internal Wiki URL]
- **Incident Management**: [Ticketing System URL]

Remember to always document your troubleshooting steps and solutions for future reference!
