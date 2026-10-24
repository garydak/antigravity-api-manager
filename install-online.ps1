param([string]$DownloadDir = (Join-Path $env:TEMP 'antigravity-api-manager-download'))
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $DownloadDir -Force | Out-Null
$zip = Join-Path $DownloadDir 'suite.zip'
Invoke-WebRequest 'https://github.com/garydak/antigravity-api-manager/archive/refs/heads/main.zip' -OutFile $zip -UseBasicParsing
Expand-Archive -LiteralPath $zip -DestinationPath $DownloadDir -Force
& (Join-Path $DownloadDir 'antigravity-api-manager-main\install-all.ps1')
