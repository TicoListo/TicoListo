param(
  [string]$OutputDirectory = ".\backups"
)

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path $OutputDirectory "ticolisto-$timestamp.sql"
docker compose exec -T db pg_dump -U ticolisto -d ticolisto | Out-File -FilePath $output -Encoding utf8
Write-Output "Backup created at $output"
