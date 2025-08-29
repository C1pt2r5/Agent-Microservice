# Monitoring Dashboard Setup Script
# This script sets up Prometheus, Grafana, and Jaeger for monitoring the agentic microservices

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [string]$Namespace = "monitoring",
    
    [Parameter(Mandatory=$false)]
    [string]$ConfigPath = "./config",
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipPrometheus,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipGrafana,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipJaeger
)

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
    
    # Check kubectl
    try {
        kubectl version --client --short | Out-Null
        Write-ColorOutput "✓ kubectl is available" $Green
    }
    catch {
        Write-ColorOutput "✗ kubectl is not available" $Red
        exit 1
    }
    
    # Check helm
    try {
        helm version --short | Out-Null
        Write-ColorOutput "✓ Helm is available" $Green
    }
    catch {
        Write-ColorOutput "✗ Helm is not available. Installing..." $Yellow
        Install-Helm
    }
}

function Install-Helm {
    Write-ColorOutput "Installing Helm..." $Blue
    
    if ($IsWindows) {
        # Install using Chocolatey if available, otherwise download directly
        try {
            choco install kubernetes-helm -y
            Write-ColorOutput "✓ Helm installed via Chocolatey" $Green
        }
        catch {
            Write-ColorOutput "Chocolatey not available, downloading Helm directly..." $Yellow
            $helmUrl = "https://get.helm.sh/helm-v3.12.0-windows-amd64.zip"
            $helmZip = "$env:TEMP\helm.zip"
            $helmDir = "$env:TEMP\helm"
            
            Invoke-WebRequest -Uri $helmUrl -OutFile $helmZip
            Expand-Archive -Path $helmZip -DestinationPath $helmDir -Force
            
            $helmExe = Get-ChildItem -Path $helmDir -Name "helm.exe" -Recurse | Select-Object -First 1
            if ($helmExe) {
                $helmPath = Join-Path $helmDir $helmExe.DirectoryName
                $env:PATH += ";$helmPath"
                Write-ColorOutput "✓ Helm downloaded and added to PATH" $Green
            }
            else {
                Write-ColorOutput "✗ Failed to install Helm" $Red
                exit 1
            }
        }
    }
    else {
        # Linux/Mac installation
        curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
        chmod 700 get_helm.sh
        ./get_helm.sh
        rm get_helm.sh
        Write-ColorOutput "✓ Helm installed" $Green
    }
}

function Initialize-Monitoring {
    Write-Banner "INITIALIZING MONITORING SETUP"
    
    # Create monitoring namespace
    Write-ColorOutput "Creating monitoring namespace..." $Blue
    if (-not $DryRun) {
        kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -
    }
    else {
        Write-ColorOutput "DRY RUN: Would create namespace $Namespace" $Yellow
    }
    
    # Add Helm repositories
    Write-ColorOutput "Adding Helm repositories..." $Blue
    if (-not $DryRun) {
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo add grafana https://grafana.github.io/helm-charts
        helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
        helm repo update
    }
    else {
        Write-ColorOutput "DRY RUN: Would add Helm repositories" $Yellow
    }
}

function Deploy-Prometheus {
    if ($SkipPrometheus) {
        Write-ColorOutput "Skipping Prometheus deployment" $Yellow
        return
    }
    
    Write-Banner "DEPLOYING PROMETHEUS"
    
    # Create Prometheus values file
    $prometheusValues = @"
server:
  persistentVolume:
    enabled: true
    size: 50Gi
    storageClass: standard
  retention: "30d"
  
  global:
    scrape_interval: 15s
    evaluation_interval: 15s
    
  extraScrapeConfigs: |
    - job_name: 'agentic-microservices'
      kubernetes_sd_configs:
        - role: pod
          namespaces:
            names:
              - agentic-dev
              - agentic-staging
              - agentic-prod
      relabel_configs:
        - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
          action: keep
          regex: true
        - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
          action: replace
          target_label: __metrics_path__
          regex: (.+)
        - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
          action: replace
          regex: ([^:]+)(?::\d+)?;(\d+)
          replacement: `${1}:`${2}
          target_label: __address__
        - action: labelmap
          regex: __meta_kubernetes_pod_label_(.+)
        - source_labels: [__meta_kubernetes_namespace]
          action: replace
          target_label: kubernetes_namespace
        - source_labels: [__meta_kubernetes_pod_name]
          action: replace
          target_label: kubernetes_pod_name

alertmanager:
  enabled: true
  persistentVolume:
    enabled: true
    size: 10Gi
    storageClass: standard

nodeExporter:
  enabled: true

pushgateway:
  enabled: true
"@
    
    $valuesFile = "$env:TEMP\prometheus-values.yaml"
    Set-Content -Path $valuesFile -Value $prometheusValues
    
    Write-ColorOutput "Installing Prometheus..." $Blue
    if (-not $DryRun) {
        helm upgrade --install prometheus prometheus-community/kube-prometheus-stack `
            --namespace $Namespace `
            --values $valuesFile `
            --wait --timeout=10m
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ Prometheus deployed successfully" $Green
        }
        else {
            Write-ColorOutput "✗ Prometheus deployment failed" $Red
        }
    }
    else {
        Write-ColorOutput "DRY RUN: Would install Prometheus" $Yellow
    }
    
    Remove-Item $valuesFile -ErrorAction SilentlyContinue
}

function Deploy-Grafana {
    if ($SkipGrafana) {
        Write-ColorOutput "Skipping Grafana deployment" $Yellow
        return
    }
    
    Write-Banner "DEPLOYING GRAFANA"
    
    # Create Grafana values file
    $grafanaValues = @"
persistence:
  enabled: true
  size: 20Gi
  storageClassName: standard

adminPassword: admin123

datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      url: http://prometheus-server:80
      access: proxy
      isDefault: true
    - name: Jaeger
      type: jaeger
      url: http://jaeger-query:16686
      access: proxy

dashboardProviders:
  dashboardproviders.yaml:
    apiVersion: 1
    providers:
    - name: 'default'
      orgId: 1
      folder: ''
      type: file
      disableDeletion: false
      editable: true
      options:
        path: /var/lib/grafana/dashboards/default

dashboards:
  default:
    agentic-overview:
      gnetId: 1860
      revision: 27
      datasource: Prometheus
    kubernetes-cluster:
      gnetId: 7249
      revision: 1
      datasource: Prometheus
    kubernetes-pods:
      gnetId: 6417
      revision: 1
      datasource: Prometheus

service:
  type: LoadBalancer
  port: 80
  targetPort: 3000

ingress:
  enabled: true
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: grafana-$Environment.agentic-microservices.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: grafana-tls
      hosts:
        - grafana-$Environment.agentic-microservices.com
"@
    
    $valuesFile = "$env:TEMP\grafana-values.yaml"
    Set-Content -Path $valuesFile -Value $grafanaValues
    
    Write-ColorOutput "Installing Grafana..." $Blue
    if (-not $DryRun) {
        helm upgrade --install grafana grafana/grafana `
            --namespace $Namespace `
            --values $valuesFile `
            --wait --timeout=10m
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ Grafana deployed successfully" $Green
        }
        else {
            Write-ColorOutput "✗ Grafana deployment failed" $Red
        }
    }
    else {
        Write-ColorOutput "DRY RUN: Would install Grafana" $Yellow
    }
    
    Remove-Item $valuesFile -ErrorAction SilentlyContinue
}

function Deploy-Jaeger {
    if ($SkipJaeger) {
        Write-ColorOutput "Skipping Jaeger deployment" $Yellow
        return
    }
    
    Write-Banner "DEPLOYING JAEGER"
    
    # Create Jaeger values file
    $jaegerValues = @"
provisionDataStore:
  cassandra: false
  elasticsearch: true

elasticsearch:
  replicas: 1
  minimumMasterNodes: 1
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 1000m
      memory: 2Gi

storage:
  type: elasticsearch
  elasticsearch:
    host: jaeger-elasticsearch-master
    port: 9200

agent:
  enabled: true
  daemonset:
    useHostPort: true

collector:
  enabled: true
  replicaCount: 1
  service:
    type: ClusterIP
    grpc:
      port: 14250
    http:
      port: 14268

query:
  enabled: true
  replicaCount: 1
  service:
    type: LoadBalancer
    port: 80
    targetPort: 16686
  ingress:
    enabled: true
    annotations:
      kubernetes.io/ingress.class: nginx
      cert-manager.io/cluster-issuer: letsencrypt-prod
    hosts:
      - host: jaeger-$Environment.agentic-microservices.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: jaeger-tls
        hosts:
          - jaeger-$Environment.agentic-microservices.com
"@
    
    $valuesFile = "$env:TEMP\jaeger-values.yaml"
    Set-Content -Path $valuesFile -Value $jaegerValues
    
    Write-ColorOutput "Installing Jaeger..." $Blue
    if (-not $DryRun) {
        helm upgrade --install jaeger jaegertracing/jaeger `
            --namespace $Namespace `
            --values $valuesFile `
            --wait --timeout=15m
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ Jaeger deployed successfully" $Green
        }
        else {
            Write-ColorOutput "✗ Jaeger deployment failed" $Red
        }
    }
    else {
        Write-ColorOutput "DRY RUN: Would install Jaeger" $Yellow
    }
    
    Remove-Item $valuesFile -ErrorAction SilentlyContinue
}

function Create-CustomDashboards {
    Write-Banner "CREATING CUSTOM DASHBOARDS"
    
    # Create custom Grafana dashboard for agentic microservices
    $agenticDashboard = @"
{
  "dashboard": {
    "id": null,
    "title": "Agentic Microservices Overview",
    "tags": ["agentic", "microservices", "ai"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Agent Response Times",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"agentic-microservices\"}[5m])) by (le, service))",
            "legendFormat": "{{service}} - 95th percentile"
          }
        ],
        "yAxes": [
          {
            "label": "Response Time (seconds)",
            "min": 0
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Agent Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{job=\"agentic-microservices\"}[5m])) by (service)",
            "legendFormat": "{{service}}"
          }
        ],
        "yAxes": [
          {
            "label": "Requests per second",
            "min": 0
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "id": 3,
        "title": "A2A Message Volume",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(a2a_messages_total[5m])) by (from_agent, to_agent)",
            "legendFormat": "{{from_agent}} -> {{to_agent}}"
          }
        ],
        "yAxes": [
          {
            "label": "Messages per second",
            "min": 0
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8}
      },
      {
        "id": 4,
        "title": "Gemini AI API Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(gemini_api_requests_total[5m])) by (model, agent)",
            "legendFormat": "{{agent}} - {{model}}"
          }
        ],
        "yAxes": [
          {
            "label": "API calls per second",
            "min": 0
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
"@
    
    if (-not $DryRun) {
        # Create ConfigMap with custom dashboard
        $dashboardConfigMap = @"
apiVersion: v1
kind: ConfigMap
metadata:
  name: agentic-dashboard
  namespace: $Namespace
  labels:
    grafana_dashboard: "1"
data:
  agentic-overview.json: |
$($agenticDashboard -replace '^', '    ')
"@
        
        $dashboardFile = "$env:TEMP\agentic-dashboard.yaml"
        Set-Content -Path $dashboardFile -Value $dashboardConfigMap
        
        kubectl apply -f $dashboardFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ Custom dashboard created" $Green
        }
        else {
            Write-ColorOutput "✗ Failed to create custom dashboard" $Red
        }
        
        Remove-Item $dashboardFile -ErrorAction SilentlyContinue
    }
    else {
        Write-ColorOutput "DRY RUN: Would create custom dashboards" $Yellow
    }
}

function Configure-Alerts {
    Write-Banner "CONFIGURING ALERTS"
    
    # Create alerting rules for agentic microservices
    $alertRules = @"
apiVersion: v1
kind: ConfigMap
metadata:
  name: agentic-alert-rules
  namespace: $Namespace
  labels:
    prometheus: kube-prometheus
    role: alert-rules
data:
  agentic.rules.yaml: |
    groups:
    - name: agentic-microservices
      rules:
      - alert: AgentHighResponseTime
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="agentic-microservices"}[5m])) by (le, service)) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time for agent {{ `$labels.service` }}"
          description: "Agent {{ `$labels.service` }} has 95th percentile response time above 2 seconds"
      
      - alert: AgentHighErrorRate
        expr: sum(rate(http_requests_total{job="agentic-microservices",status=~"5.."}[5m])) by (service) / sum(rate(http_requests_total{job="agentic-microservices"}[5m])) by (service) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate for agent {{ `$labels.service` }}"
          description: "Agent {{ `$labels.service` }} has error rate above 5%"
      
      - alert: A2AMessageBacklog
        expr: a2a_message_queue_size > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "A2A message backlog detected"
          description: "A2A message queue has {{ `$value` }} pending messages"
      
      - alert: GeminiAPIRateLimit
        expr: increase(gemini_api_rate_limit_errors_total[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Gemini API rate limit exceeded"
          description: "Gemini API rate limit has been exceeded {{ `$value` }} times in the last 5 minutes"
      
      - alert: AgentPodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total{namespace=~"agentic-.*"}[15m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Agent pod is crash looping"
          description: "Pod {{ `$labels.pod` }} in namespace {{ `$labels.namespace` }} is crash looping"
"@
    
    if (-not $DryRun) {
        $alertFile = "$env:TEMP\agentic-alerts.yaml"
        Set-Content -Path $alertFile -Value $alertRules
        
        kubectl apply -f $alertFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ Alert rules configured" $Green
        }
        else {
            Write-ColorOutput "✗ Failed to configure alert rules" $Red
        }
        
        Remove-Item $alertFile -ErrorAction SilentlyContinue
    }
    else {
        Write-ColorOutput "DRY RUN: Would configure alert rules" $Yellow
    }
}

function Show-MonitoringInfo {
    Write-Banner "MONITORING SETUP SUMMARY"
    
    Write-ColorOutput "Environment: $Environment" $Blue
    Write-ColorOutput "Namespace: $Namespace" $Blue
    Write-ColorOutput "Dry Run: $DryRun" $Blue
    
    if (-not $DryRun) {
        Write-ColorOutput "`nDeployed Services:" $Blue
        kubectl get services -n $Namespace
        
        Write-ColorOutput "`nIngress Information:" $Blue
        kubectl get ingress -n $Namespace
        
        Write-ColorOutput "`nAccess Information:" $Blue
        
        # Get Grafana admin password
        $grafanaPassword = kubectl get secret --namespace $Namespace grafana -o jsonpath="{.data.admin-password}" 2>$null
        if ($grafanaPassword) {
            $decodedPassword = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($grafanaPassword))
            Write-ColorOutput "Grafana Admin Password: $decodedPassword" $Green
        }
        
        # Get service URLs
        $grafanaIP = kubectl get service grafana -n $Namespace -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null
        if ($grafanaIP) {
            Write-ColorOutput "Grafana URL: http://$grafanaIP" $Green
        }
        
        $jaegerIP = kubectl get service jaeger-query -n $Namespace -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null
        if ($jaegerIP) {
            Write-ColorOutput "Jaeger URL: http://$jaegerIP" $Green
        }
        
        $prometheusIP = kubectl get service prometheus-server -n $Namespace -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null
        if ($prometheusIP) {
            Write-ColorOutput "Prometheus URL: http://$prometheusIP" $Green
        }
    }
}

# Main execution
try {
    Write-Banner "AGENTIC MICROSERVICES MONITORING SETUP"
    Write-ColorOutput "Setting up monitoring for environment: $Environment" $Blue
    
    Test-Prerequisites
    Initialize-Monitoring
    Deploy-Prometheus
    Deploy-Grafana
    Deploy-Jaeger
    Create-CustomDashboards
    Configure-Alerts
    Show-MonitoringInfo
    
    Write-ColorOutput "`n🎉 Monitoring setup completed successfully!" $Green
    Write-ColorOutput "Your monitoring stack is now ready!" $Green
    
}
catch {
    Write-ColorOutput "`n💥 Monitoring setup failed: $($_.Exception.Message)" $Red
    Write-ColorOutput "Check the logs above for more details." $Red
    exit 1
}