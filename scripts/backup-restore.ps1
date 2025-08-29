# Backup and Disaster Recovery Script
# This script handles backup and restore operations for the agentic microservices system

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("backup", "restore", "list", "cleanup")]
    [string]$Operation,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [string]$BackupName = "",
    
    [Parameter(Mandatory=$false)]
    [string]$BackupLocation = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ConfigPath = "./config",
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [int]$RetentionDays = 30
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
    
    # Check gcloud
    try {
        gcloud version --quiet | Out-Null
        Write-ColorOutput "✓ gcloud is available" $Green
    }
    catch {
        Write-ColorOutput "✗ gcloud is not available" $Red
        exit 1
    }
    
    # Check velero (for Kubernetes backups)
    try {
        velero version --client-only | Out-Null
        Write-ColorOutput "✓ Velero is available" $Green
    }
    catch {
        Write-ColorOutput "⚠ Velero is not available, some backup features may be limited" $Yellow
    }
}

function Initialize-BackupConfiguration {
    Write-Banner "INITIALIZING BACKUP CONFIGURATION"
    
    # Load environment configuration
    $configFile = Join-Path $ConfigPath "environments" "$Environment.yaml"
    if (-not (Test-Path $configFile)) {
        Write-ColorOutput "✗ Configuration file not found: $configFile" $Red
        exit 1
    }
    
    # Parse configuration (simplified)
    $configContent = Get-Content $configFile -Raw
    
    if ($configContent -match "project_id:\s*[`"']?([^`"'\r\n]+)[`"']?") {
        $script:ProjectId = $matches[1].Trim()
    }
    
    if ($configContent -match "namespace:\s*[`"']?([^`"'\r\n]+)[`"']?") {
        $script:Namespace = $matches[1].Trim()
    }
    
    # Set backup location if not provided
    if (-not $BackupLocation) {
        $script:BackupLocation = "gs://$script:ProjectId-backups/$Environment"
    }
    else {
        $script:BackupLocation = $BackupLocation
    }
    
    # Generate backup name if not provided
    if (-not $BackupName -and $Operation -eq "backup") {
        $timestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
        $script:BackupName = "$Environment-backup-$timestamp"
    }
    else {
        $script:BackupName = $BackupName
    }
    
    Write-ColorOutput "Backup Configuration:" $Blue
    Write-ColorOutput "  Project ID: $script:ProjectId" $Blue
    Write-ColorOutput "  Namespace: $script:Namespace" $Blue
    Write-ColorOutput "  Backup Location: $script:BackupLocation" $Blue
    Write-ColorOutput "  Backup Name: $script:BackupName" $Blue
}

function Invoke-Backup {
    Write-Banner "CREATING BACKUP"
    
    $backupDir = "$env:TEMP\agentic-backup-$script:BackupName"
    
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }
    
    # Backup Kubernetes resources
    Write-ColorOutput "Backing up Kubernetes resources..." $Blue
    Backup-KubernetesResources $backupDir
    
    # Backup persistent data
    Write-ColorOutput "Backing up persistent data..." $Blue
    Backup-PersistentData $backupDir
    
    # Backup configuration
    Write-ColorOutput "Backing up configuration..." $Blue
    Backup-Configuration $backupDir
    
    # Create backup metadata
    Write-ColorOutput "Creating backup metadata..." $Blue
    Create-BackupMetadata $backupDir
    
    # Upload to cloud storage
    Write-ColorOutput "Uploading backup to cloud storage..." $Blue
    Upload-Backup $backupDir
    
    # Cleanup local backup
    if (-not $DryRun) {
        Remove-Item -Path $backupDir -Recurse -Force
        Write-ColorOutput "✓ Local backup files cleaned up" $Green
    }
    
    Write-ColorOutput "✓ Backup completed successfully" $Green
}

function Backup-KubernetesResources {
    param([string]$BackupDir)
    
    $k8sBackupDir = Join-Path $BackupDir "kubernetes"
    
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $k8sBackupDir -Force | Out-Null
    }
    
    # Backup all resources in the namespace
    $resourceTypes = @(
        "deployments",
        "services", 
        "configmaps",
        "secrets",
        "persistentvolumeclaims",
        "ingresses",
        "horizontalpodautoscalers"
    )
    
    foreach ($resourceType in $resourceTypes) {
        Write-ColorOutput "  Backing up $resourceType..." $Blue
        
        if (-not $DryRun) {
            $outputFile = Join-Path $k8sBackupDir "$resourceType.yaml"
            kubectl get $resourceType -n $script:Namespace -o yaml > $outputFile
            
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "    ✓ $resourceType backed up" $Green
            }
            else {
                Write-ColorOutput "    ⚠ Failed to backup $resourceType" $Yellow
            }
        }
        else {
            Write-ColorOutput "    DRY RUN: Would backup $resourceType" $Yellow
        }
    }
    
    # Backup cluster-level resources
    Write-ColorOutput "  Backing up cluster resources..." $Blue
    if (-not $DryRun) {
        $clusterFile = Join-Path $k8sBackupDir "cluster-resources.yaml"
        kubectl get namespaces,clusterroles,clusterrolebindings -o yaml > $clusterFile
    }
    else {
        Write-ColorOutput "    DRY RUN: Would backup cluster resources" $Yellow
    }
}

function Backup-PersistentData {
    param([string]$BackupDir)
    
    $dataBackupDir = Join-Path $BackupDir "data"
    
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $dataBackupDir -Force | Out-Null
    }
    
    # Get all PVCs in the namespace
    $pvcs = kubectl get pvc -n $script:Namespace -o jsonpath='{.items[*].metadata.name}' 2>$null
    
    if ($pvcs) {
        $pvcList = $pvcs -split ' '
        
        foreach ($pvc in $pvcList) {
            Write-ColorOutput "  Backing up PVC: $pvc..." $Blue
            
            if (-not $DryRun) {
                # Create a backup job for each PVC
                $backupJobYaml = @"
apiVersion: batch/v1
kind: Job
metadata:
  name: backup-$pvc-$(Get-Date -Format 'yyyyMMdd-HHmmss')
  namespace: $script:Namespace
spec:
  template:
    spec:
      containers:
      - name: backup
        image: alpine:latest
        command: ["/bin/sh"]
        args: ["-c", "tar czf /backup/$pvc-backup.tar.gz -C /data . && echo 'Backup completed for $pvc'"]
        volumeMounts:
        - name: data
          mountPath: /data
        - name: backup-storage
          mountPath: /backup
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: $pvc
      - name: backup-storage
        emptyDir: {}
      restartPolicy: Never
  backoffLimit: 3
"@
                
                $jobFile = "$env:TEMP\backup-job-$pvc.yaml"
                Set-Content -Path $jobFile -Value $backupJobYaml
                
                kubectl apply -f $jobFile
                
                if ($LASTEXITCODE -eq 0) {
                    Write-ColorOutput "    ✓ Backup job created for $pvc" $Green
                }
                else {
                    Write-ColorOutput "    ✗ Failed to create backup job for $pvc" $Red
                }
                
                Remove-Item $jobFile -ErrorAction SilentlyContinue
            }
            else {
                Write-ColorOutput "    DRY RUN: Would backup PVC $pvc" $Yellow
            }
        }
    }
    else {
        Write-ColorOutput "  No PVCs found to backup" $Yellow
    }
}

function Backup-Configuration {
    param([string]$BackupDir)
    
    $configBackupDir = Join-Path $BackupDir "configuration"
    
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $configBackupDir -Force | Out-Null
        
        # Copy configuration files
        Copy-Item -Path $ConfigPath -Destination $configBackupDir -Recurse -Force
        
        Write-ColorOutput "  ✓ Configuration files backed up" $Green
    }
    else {
        Write-ColorOutput "  DRY RUN: Would backup configuration files" $Yellow
    }
}

function Create-BackupMetadata {
    param([string]$BackupDir)
    
    $metadata = @{
        backup_name = $script:BackupName
        environment = $Environment
        project_id = $script:ProjectId
        namespace = $script:Namespace
        timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
        kubernetes_version = (kubectl version -o json | ConvertFrom-Json).serverVersion.gitVersion
        backup_type = "full"
        retention_days = $RetentionDays
    }
    
    if (-not $DryRun) {
        $metadataFile = Join-Path $BackupDir "metadata.json"
        $metadata | ConvertTo-Json -Depth 10 | Set-Content -Path $metadataFile
        
        Write-ColorOutput "  ✓ Backup metadata created" $Green
    }
    else {
        Write-ColorOutput "  DRY RUN: Would create backup metadata" $Yellow
    }
}

function Upload-Backup {
    param([string]$BackupDir)
    
    if (-not $DryRun) {
        # Create archive
        $archivePath = "$BackupDir.tar.gz"
        tar -czf $archivePath -C (Split-Path $BackupDir) (Split-Path $BackupDir -Leaf)
        
        # Upload to Google Cloud Storage
        gsutil cp $archivePath "$script:BackupLocation/"
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "  ✓ Backup uploaded to $script:BackupLocation" $Green
        }
        else {
            Write-ColorOutput "  ✗ Failed to upload backup" $Red
        }
        
        # Cleanup archive
        Remove-Item $archivePath -ErrorAction SilentlyContinue
    }
    else {
        Write-ColorOutput "  DRY RUN: Would upload backup to $script:BackupLocation" $Yellow
    }
}

function Invoke-Restore {
    Write-Banner "RESTORING FROM BACKUP"
    
    if (-not $BackupName) {
        Write-ColorOutput "✗ Backup name is required for restore operation" $Red
        exit 1
    }
    
    # Download backup
    Write-ColorOutput "Downloading backup..." $Blue
    $backupArchive = "$env:TEMP\$script:BackupName.tar.gz"
    $backupDir = "$env:TEMP\$script:BackupName"
    
    if (-not $DryRun) {
        gsutil cp "$script:BackupLocation/$script:BackupName.tar.gz" $backupArchive
        
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "✗ Failed to download backup" $Red
            exit 1
        }
        
        # Extract backup
        tar -xzf $backupArchive -C $env:TEMP
        
        if (-not (Test-Path $backupDir)) {
            Write-ColorOutput "✗ Backup extraction failed" $Red
            exit 1
        }
    }
    else {
        Write-ColorOutput "DRY RUN: Would download and extract backup" $Yellow
        return
    }
    
    # Verify backup integrity
    Write-ColorOutput "Verifying backup integrity..." $Blue
    $metadataFile = Join-Path $backupDir "metadata.json"
    if (-not (Test-Path $metadataFile)) {
        Write-ColorOutput "✗ Backup metadata not found" $Red
        exit 1
    }
    
    $metadata = Get-Content $metadataFile | ConvertFrom-Json
    Write-ColorOutput "  Backup Name: $($metadata.backup_name)" $Blue
    Write-ColorOutput "  Environment: $($metadata.environment)" $Blue
    Write-ColorOutput "  Timestamp: $($metadata.timestamp)" $Blue
    
    # Confirm restore
    if (-not $Force) {
        $confirmation = Read-Host "Are you sure you want to restore from this backup? This will overwrite existing resources. (yes/no)"
        if ($confirmation -ne "yes") {
            Write-ColorOutput "Restore cancelled by user" $Yellow
            return
        }
    }
    
    # Restore Kubernetes resources
    Write-ColorOutput "Restoring Kubernetes resources..." $Blue
    Restore-KubernetesResources $backupDir
    
    # Restore persistent data
    Write-ColorOutput "Restoring persistent data..." $Blue
    Restore-PersistentData $backupDir
    
    # Cleanup
    Remove-Item -Path $backupDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $backupArchive -ErrorAction SilentlyContinue
    
    Write-ColorOutput "✓ Restore completed successfully" $Green
}

function Restore-KubernetesResources {
    param([string]$BackupDir)
    
    $k8sBackupDir = Join-Path $BackupDir "kubernetes"
    
    if (-not (Test-Path $k8sBackupDir)) {
        Write-ColorOutput "  ⚠ No Kubernetes backup found" $Yellow
        return
    }
    
    # Restore resources in order
    $restoreOrder = @(
        "configmaps",
        "secrets",
        "persistentvolumeclaims",
        "services",
        "deployments",
        "ingresses",
        "horizontalpodautoscalers"
    )
    
    foreach ($resourceType in $restoreOrder) {
        $resourceFile = Join-Path $k8sBackupDir "$resourceType.yaml"
        
        if (Test-Path $resourceFile) {
            Write-ColorOutput "  Restoring $resourceType..." $Blue
            
            kubectl apply -f $resourceFile -n $script:Namespace
            
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "    ✓ $resourceType restored" $Green
            }
            else {
                Write-ColorOutput "    ✗ Failed to restore $resourceType" $Red
            }
        }
        else {
            Write-ColorOutput "    ⚠ No backup found for $resourceType" $Yellow
        }
    }
}

function Restore-PersistentData {
    param([string]$BackupDir)
    
    $dataBackupDir = Join-Path $BackupDir "data"
    
    if (-not (Test-Path $dataBackupDir)) {
        Write-ColorOutput "  ⚠ No persistent data backup found" $Yellow
        return
    }
    
    Write-ColorOutput "  ⚠ Persistent data restore requires manual intervention" $Yellow
    Write-ColorOutput "  Please check the backup directory for data files and restore manually" $Yellow
}

function Get-BackupList {
    Write-Banner "LISTING BACKUPS"
    
    Write-ColorOutput "Fetching backup list from $script:BackupLocation..." $Blue
    
    if (-not $DryRun) {
        $backups = gsutil ls "$script:BackupLocation/*.tar.gz" 2>$null
        
        if ($backups) {
            Write-ColorOutput "`nAvailable Backups:" $Blue
            Write-ColorOutput "$('-' * 80)" $Blue
            
            foreach ($backup in $backups) {
                $backupName = [System.IO.Path]::GetFileNameWithoutExtension([System.IO.Path]::GetFileNameWithoutExtension($backup))
                $backupInfo = gsutil stat $backup 2>$null
                
                if ($backupInfo) {
                    $size = ($backupInfo | Select-String "Content-Length:").ToString().Split(":")[1].Trim()
                    $created = ($backupInfo | Select-String "Time created:").ToString().Split(":",2)[1].Trim()
                    
                    Write-ColorOutput "Name: $backupName" $Green
                    Write-ColorOutput "Size: $([math]::Round([int64]$size / 1MB, 2)) MB" $Blue
                    Write-ColorOutput "Created: $created" $Blue
                    Write-ColorOutput "$('-' * 40)" $Blue
                }
            }
        }
        else {
            Write-ColorOutput "No backups found in $script:BackupLocation" $Yellow
        }
    }
    else {
        Write-ColorOutput "DRY RUN: Would list backups from $script:BackupLocation" $Yellow
    }
}

function Invoke-BackupCleanup {
    Write-Banner "CLEANING UP OLD BACKUPS"
    
    Write-ColorOutput "Cleaning up backups older than $RetentionDays days..." $Blue
    
    if (-not $DryRun) {
        $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
        $backups = gsutil ls -l "$script:BackupLocation/*.tar.gz" 2>$null
        
        if ($backups) {
            foreach ($line in $backups) {
                if ($line -match "^\s*(\d+)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s+(.+)$") {
                    $backupDate = [DateTime]::Parse($matches[2])
                    $backupPath = $matches[3]
                    $backupName = [System.IO.Path]::GetFileName($backupPath)
                    
                    if ($backupDate -lt $cutoffDate) {
                        Write-ColorOutput "  Deleting old backup: $backupName (created: $backupDate)" $Yellow
                        gsutil rm $backupPath
                        
                        if ($LASTEXITCODE -eq 0) {
                            Write-ColorOutput "    ✓ Deleted $backupName" $Green
                        }
                        else {
                            Write-ColorOutput "    ✗ Failed to delete $backupName" $Red
                        }
                    }
                }
            }
        }
        else {
            Write-ColorOutput "No backups found to clean up" $Yellow
        }
    }
    else {
        Write-ColorOutput "DRY RUN: Would clean up backups older than $RetentionDays days" $Yellow
    }
}

# Main execution
try {
    Write-Banner "AGENTIC MICROSERVICES BACKUP & RESTORE"
    Write-ColorOutput "Operation: $Operation" $Blue
    Write-ColorOutput "Environment: $Environment" $Blue
    
    # Initialize variables
    $script:ProjectId = ""
    $script:Namespace = ""
    $script:BackupLocation = $BackupLocation
    $script:BackupName = $BackupName
    
    Test-Prerequisites
    Initialize-BackupConfiguration
    
    switch ($Operation) {
        "backup" {
            Invoke-Backup
        }
        "restore" {
            Invoke-Restore
        }
        "list" {
            Get-BackupList
        }
        "cleanup" {
            Invoke-BackupCleanup
        }
    }
    
    Write-ColorOutput "`n✅ $Operation operation completed successfully!" $Green
    
}
catch {
    Write-ColorOutput "`n💥 $Operation operation failed: $($_.Exception.Message)" $Red
    Write-ColorOutput "Check the logs above for more details." $Red
    exit 1
}