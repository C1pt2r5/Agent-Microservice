# Agentic Microservices Operational Runbook

## Table of Contents

1. [System Overview](#system-overview)
2. [Daily Operations](#daily-operations)
3. [Monitoring and Alerting](#monitoring-and-alerting)
4. [Incident Response](#incident-response)
5. [Maintenance Procedures](#maintenance-procedures)
6. [Scaling Operations](#scaling-operations)
7. [Backup and Recovery](#backup-and-recovery)
8. [Security Operations](#security-operations)
9. [Performance Optimization](#performance-optimization)
10. [Emergency Procedures](#emergency-procedures)

## System Overview

### Architecture Components

- **AI Agents**: Chatbot, Fraud Detection, Recommendation
- **Infrastructure Services**: MCP Gateway, A2A Hub, ADK
- **External Dependencies**: Gemini AI, Redis, External APIs
- **Monitoring Stack**: Prometheus, Grafana, Jaeger

### Key Metrics to Monitor

- **Response Times**: < 2 seconds for 95th percentile
- **Error Rates**: < 5% for all services
- **Throughput**: > 100 requests/second per agent
- **Resource Usage**: < 80% CPU and memory utilization
- **A2A Message Latency**: < 500ms average

## Daily Operations

### Morning Health Check (9:00 AM)

```powershell
# Check overall system health
kubectl get pods -n agentic-prod
kubectl get services -n agentic-prod
kubectl top nodes
kubectl top pods -n agentic-prod

# Check monitoring dashboards
# - Grafana: System Overview Dashboard
# - Prometheus: Alert Status
# - Jaeger: Trace Analysis
```

### Key Daily Tasks

1. **Review Overnight Alerts**
   - Check Grafana for any triggered alerts
   - Review Prometheus alert history
   - Investigate any anomalies in Jaeger traces

2. **Verify Service Health**
   - Confirm all pods are running and ready
   - Check service endpoints are responding
   - Validate external API connectivity

3. **Review Performance Metrics**
   - Agent response times
   - A2A message throughput
   - Gemini AI API usage and quotas
   - Resource utilization trends

4. **Check Backup Status**
   - Verify last night's backup completed successfully
   - Review backup retention and cleanup

### Evening Review (6:00 PM)

```powershell
# Generate daily report
./scripts/generate-daily-report.ps1 -Environment production

# Check for any pending maintenance
kubectl get events -n agentic-prod --sort-by='.lastTimestamp'

# Review capacity planning metrics
kubectl top nodes
kubectl describe hpa -n agentic-prod
```

## Monitoring and Alerting

### Critical Alerts (Immediate Response Required)

#### Agent Down Alert

```yaml
Alert: AgentPodCrashLooping
Severity: Critical
Response Time: < 5 minutes
```

**Response Steps:**

1. Check pod status: `kubectl get pods -n agentic-prod`
2. Review pod logs: `kubectl logs <pod-name> -n agentic-prod`
3. Check recent deployments: `kubectl rollout history deployment/<agent-name> -n agentic-prod`
4. If needed, rollback: `kubectl rollout undo deployment/<agent-name> -n agentic-prod`

#### High Error Rate Alert

```yaml
Alert: AgentHighErrorRate
Severity: Critical
Response Time: < 10 minutes
```

**Response Steps:**

1. Identify affected service in Grafana dashboard
2. Check service logs for error patterns
3. Review recent configuration changes
4. Check external dependency status (Gemini AI, Redis)
5. Scale up service if needed: `kubectl scale deployment <service> --replicas=<count> -n agentic-prod`

#### Gemini API Rate Limit

```yaml
Alert: GeminiAPIRateLimit
Severity: Warning
Response Time: < 15 minutes
```

**Response Steps:**

1. Check current API usage in monitoring dashboard
2. Review rate limiting configuration
3. Implement request queuing if not already active
4. Consider scaling down non-critical AI operations
5. Contact Google Cloud support if limits need adjustment

### Warning Alerts (Response Within 1 Hour)

#### High Response Time

- Check system load and resource utilization
- Review recent deployments or configuration changes
- Consider horizontal scaling if sustained

#### A2A Message Backlog

- Check A2A Hub health and connectivity
- Review message processing rates
- Clear any stuck messages if identified

#### Storage Space Low

- Check PVC usage: `kubectl get pvc -n agentic-prod`
- Clean up old logs and temporary files
- Consider expanding storage if needed

## Incident Response

### Severity Levels

#### Severity 1 (Critical)

- **Definition**: Complete service outage or data loss
- **Response Time**: < 15 minutes
- **Escalation**: Immediate notification to on-call engineer and management

#### Severity 2 (High)

- **Definition**: Significant service degradation affecting users
- **Response Time**: < 1 hour
- **Escalation**: Notification to on-call engineer

#### Severity 3 (Medium)

- **Definition**: Minor service issues or performance degradation
- **Response Time**: < 4 hours
- **Escalation**: Standard ticket assignment

#### Severity 4 (Low)

- **Definition**: Cosmetic issues or minor bugs
- **Response Time**: Next business day
- **Escalation**: Standard ticket assignment

### Incident Response Process

1. **Detection and Alerting**
   - Monitor alerts from Prometheus/Grafana
   - User reports via support channels
   - Automated health checks

2. **Initial Response**
   - Acknowledge the incident
   - Assess severity and impact
   - Form incident response team if needed

3. **Investigation and Diagnosis**
   - Gather relevant logs and metrics
   - Identify root cause
   - Document findings

4. **Resolution and Recovery**
   - Implement fix or workaround
   - Verify service restoration
   - Monitor for stability

5. **Post-Incident Review**
   - Document lessons learned
   - Update runbooks and procedures
   - Implement preventive measures

### Common Incident Scenarios

#### Scenario: Chatbot Agent Not Responding

**Symptoms:**

- HTTP 503 errors from chatbot endpoint
- High response times or timeouts
- Users unable to get chat responses

**Investigation Steps:**

```powershell
# Check pod status
kubectl get pods -l app=chatbot-agent -n agentic-prod

# Check service endpoints
kubectl get endpoints chatbot-agent -n agentic-prod

# Review logs
kubectl logs -l app=chatbot-agent -n agentic-prod --tail=100

# Check resource usage
kubectl top pods -l app=chatbot-agent -n agentic-prod
```

**Resolution Steps:**

1. If pods are not running, check for resource constraints
2. If pods are running but not ready, check health check endpoints
3. Review recent deployments and configuration changes
4. Scale up if needed: `kubectl scale deployment chatbot-agent --replicas=3 -n agentic-prod`
5. If persistent, consider rolling back to previous version

#### Scenario: Fraud Detection False Positives

**Symptoms:**

- Increased customer complaints about blocked transactions
- High fraud alert volume in monitoring
- Unusual patterns in fraud detection metrics

**Investigation Steps:**

```powershell
# Check fraud detection logs
kubectl logs -l app=fraud-detection-agent -n agentic-prod | grep -i "fraud"

# Review Gemini AI model responses
# Check Jaeger traces for fraud detection requests

# Analyze recent transaction patterns
```

**Resolution Steps:**

1. Review fraud detection thresholds and rules
2. Check for recent model updates or configuration changes
3. Temporarily adjust sensitivity if needed
4. Coordinate with business team for rule adjustments
5. Monitor impact of changes

## Maintenance Procedures

### Planned Maintenance Windows

**Preferred Times:**

- **Development**: Anytime during business hours
- **Staging**: Evenings (6 PM - 10 PM local time)
- **Production**: Weekends (Saturday 2 AM - 6 AM local time)

### Pre-Maintenance Checklist

```powershell
# 1. Verify backup completion
./scripts/backup-restore.ps1 -Operation backup -Environment production

# 2. Check system health
kubectl get pods -n agentic-prod
kubectl get nodes

# 3. Review current load
kubectl top nodes
kubectl top pods -n agentic-prod

# 4. Notify stakeholders
# Send maintenance notification email

# 5. Prepare rollback plan
# Document current versions and configurations
```

### During Maintenance

1. **Monitor System Health**
   - Keep monitoring dashboards open
   - Watch for any unexpected alerts
   - Monitor user-facing services

2. **Follow Change Management Process**
   - Apply changes incrementally
   - Verify each step before proceeding
   - Document all changes made

3. **Test After Each Change**
   - Run smoke tests
   - Verify service endpoints
   - Check monitoring metrics

### Post-Maintenance Checklist

```powershell
# 1. Verify all services are running
kubectl get pods -n agentic-prod
./scripts/health-check.ps1 -Environment production

# 2. Run comprehensive tests
./scripts/smoke-tests.ps1 -Environment production

# 3. Monitor for 30 minutes
# Watch dashboards for any anomalies

# 4. Update documentation
# Record any configuration changes

# 5. Notify stakeholders
# Send maintenance completion notification
```

## Scaling Operations

### Horizontal Pod Autoscaling (HPA)

**Current HPA Configuration:**

- **Target CPU**: 70%
- **Target Memory**: 80%
- **Min Replicas**: 2 (staging), 5 (production)
- **Max Replicas**: 10 (staging), 50 (production)

**Manual Scaling Commands:**

```powershell
# Scale specific service
kubectl scale deployment chatbot-agent --replicas=10 -n agentic-prod

# Check HPA status
kubectl get hpa -n agentic-prod

# View HPA details
kubectl describe hpa chatbot-agent -n agentic-prod
```

### Vertical Scaling

**When to Consider:**

- Consistent high resource usage across all pods
- Memory leaks or CPU bottlenecks identified
- Performance issues not resolved by horizontal scaling

**Process:**

1. Update resource requests/limits in deployment manifests
2. Apply changes: `kubectl apply -f k8s/deployments.yaml`
3. Monitor pod restart and performance impact
4. Adjust as needed based on metrics

### Cluster Scaling

**Node Pool Scaling:**

```powershell
# Check current node capacity
kubectl get nodes
kubectl describe nodes

# Scale node pool (GKE)
gcloud container clusters resize agentic-prod-cluster --num-nodes=10 --region=us-central1
```

## Backup and Recovery

### Backup Schedule

- **Development**: Daily at 2 AM, 7-day retention
- **Staging**: Daily at 1 AM, 30-day retention
- **Production**: Daily at 12 AM, 90-day retention

### Backup Verification

```powershell
# Check last backup status
./scripts/backup-restore.ps1 -Operation list -Environment production

# Verify backup integrity
gsutil ls -l gs://agentic-prod-backups/production/

# Test restore process (staging environment)
./scripts/backup-restore.ps1 -Operation restore -Environment staging -BackupName latest
```

### Disaster Recovery Procedures

#### RTO/RPO Targets

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 24 hours

#### DR Steps

1. **Assess Damage**
   - Determine scope of outage
   - Identify affected components
   - Estimate recovery time

2. **Activate DR Plan**
   - Notify stakeholders
   - Assemble recovery team
   - Begin recovery procedures

3. **Restore Services**
   - Deploy to backup region if needed
   - Restore from latest backup
   - Verify service functionality

4. **Resume Operations**
   - Switch traffic to recovered services
   - Monitor system stability
   - Communicate status to users

## Security Operations

### Security Monitoring

**Daily Security Checks:**

- Review authentication logs
- Check for unusual API access patterns
- Monitor certificate expiration dates
- Verify security patches are current

### Security Incident Response

1. **Immediate Actions**
   - Isolate affected systems
   - Preserve evidence
   - Notify security team

2. **Investigation**
   - Analyze logs and traces
   - Identify attack vectors
   - Assess data exposure

3. **Containment**
   - Block malicious traffic
   - Revoke compromised credentials
   - Apply security patches

4. **Recovery**
   - Restore from clean backups
   - Update security configurations
   - Monitor for reoccurrence

### Certificate Management

```powershell
# Check certificate expiration
kubectl get certificates -n agentic-prod

# Renew certificates (cert-manager)
kubectl annotate certificate <cert-name> cert-manager.io/issue-temporary-certificate="true" -n agentic-prod
```

## Performance Optimization

### Performance Monitoring

**Key Metrics:**

- Response time percentiles (50th, 95th, 99th)
- Throughput (requests per second)
- Error rates
- Resource utilization

### Optimization Strategies

1. **Application Level**
   - Optimize database queries
   - Implement caching strategies
   - Reduce external API calls
   - Optimize AI model inference

2. **Infrastructure Level**
   - Adjust resource allocations
   - Optimize network configuration
   - Implement load balancing
   - Use appropriate storage classes

3. **Configuration Level**
   - Tune JVM parameters
   - Optimize connection pools
   - Adjust timeout values
   - Configure appropriate limits

### Performance Testing

```powershell
# Run load tests
./scripts/load-test.ps1 -Environment staging -Duration 300 -Concurrency 100

# Analyze results
./scripts/analyze-performance.ps1 -TestResults latest
```

## Emergency Procedures

### Emergency Contacts

- **On-Call Engineer**: [Phone/Slack]
- **System Administrator**: [Phone/Email]
- **Development Team Lead**: [Phone/Email]
- **Business Stakeholder**: [Phone/Email]

### Emergency Response Checklist

1. **Assess Situation**
   - [ ] Determine severity level
   - [ ] Identify affected services
   - [ ] Estimate user impact

2. **Immediate Actions**
   - [ ] Notify on-call engineer
   - [ ] Create incident ticket
   - [ ] Begin investigation

3. **Communication**
   - [ ] Update status page
   - [ ] Notify stakeholders
   - [ ] Provide regular updates

4. **Resolution**
   - [ ] Implement fix or workaround
   - [ ] Verify service restoration
   - [ ] Monitor stability

5. **Follow-up**
   - [ ] Conduct post-incident review
   - [ ] Update documentation
   - [ ] Implement improvements

### Emergency Rollback Procedures

```powershell
# Quick rollback to previous version
kubectl rollout undo deployment/<service-name> -n agentic-prod

# Rollback to specific revision
kubectl rollout undo deployment/<service-name> --to-revision=<revision> -n agentic-prod

# Check rollback status
kubectl rollout status deployment/<service-name> -n agentic-prod
```

### Circuit Breaker Activation

```powershell
# Manually trigger circuit breaker for external service
kubectl patch configmap mcp-gateway-config -n agentic-prod --patch '{"data":{"circuit_breaker_enabled":"true"}}'

# Restart affected services
kubectl rollout restart deployment/mcp-gateway -n agentic-prod
```

---

## Appendix

### Useful Commands Reference

```powershell
# System Health
kubectl get pods -n agentic-prod
kubectl get services -n agentic-prod
kubectl top nodes
kubectl top pods -n agentic-prod

# Logs
kubectl logs -f deployment/chatbot-agent -n agentic-prod
kubectl logs --previous deployment/fraud-detection-agent -n agentic-prod

# Scaling
kubectl scale deployment <name> --replicas=<count> -n agentic-prod
kubectl get hpa -n agentic-prod

# Configuration
kubectl get configmaps -n agentic-prod
kubectl get secrets -n agentic-prod

# Troubleshooting
kubectl describe pod <pod-name> -n agentic-prod
kubectl get events -n agentic-prod --sort-by='.lastTimestamp'
```

### Monitoring URLs

- **Grafana**: <https://grafana-production.agentic-microservices.com>
- **Prometheus**: <https://prometheus-production.agentic-microservices.com>
- **Jaeger**: <https://jaeger-production.agentic-microservices.com>
- **Kubernetes Dashboard**: <https://k8s-dashboard-production.agentic-microservices.com>

This runbook should be reviewed and updated monthly to ensure accuracy and completeness.
