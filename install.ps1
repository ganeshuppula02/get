# Undoable installer for Windows. Run in PowerShell:
#   irm https://raw.githubusercontent.com/ganeshuppula02/get/main/install.ps1 | iex
# What it does: checks for Node.js (offers to install it with winget), downloads Undoable,
# installs it with npm, and checks that the `undoable` command works. Nothing else is changed.

function Install-Undoable {
  $ErrorActionPreference = 'Stop'
  $base = if ($env:UNDOABLE_DOWNLOAD) { $env:UNDOABLE_DOWNLOAD.TrimEnd('/') } else { 'https://raw.githubusercontent.com/ganeshuppula02/get/main' }
  Write-Host ''
  Write-Host 'Installing Undoable: an undo button and guardrails for AI coding agents' -ForegroundColor Cyan
  Write-Host ''

  function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  }
  function Node-Major {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return 0 }
    # `node --version` prints v22.12.0. (Not node -p "...": Windows PowerShell 5.1 strips the inner quotes.)
    try { $v = (& node --version 2>$null | Out-String).Trim() } catch { return 0 }
    if ($v -match '^v(\d+)\.') { return [int]$Matches[1] }
    return 0
  }

  # 1. Node.js 20 or newer (22 or newer for Slack approvals)
  $major = Node-Major
  if ($major -lt 20) {
    if ($major -gt 0) { Write-Host "Node.js $major is too old: Undoable needs version 20 or newer." -ForegroundColor Yellow }
    else { Write-Host 'Node.js is not installed. Undoable needs it.' -ForegroundColor Yellow }
    if (Get-Command winget -ErrorAction SilentlyContinue) {
      Write-Host 'Installing Node.js LTS with winget (Windows may ask for permission)...'
      winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements | Out-Host
      Refresh-Path
      $major = Node-Major
    }
    if ($major -lt 20) {
      Write-Host ''
      Write-Host 'Please install Node.js LTS from https://nodejs.org, then close this window, open a new PowerShell and run the install line again.' -ForegroundColor Yellow
      return
    }
  }
  Write-Host "[ok] Node.js $major"

  # 2. Download
  $file = Join-Path $env:TEMP 'undoable-cli-latest.tgz'
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    if (Test-Path -LiteralPath $base -PathType Container) { Copy-Item -LiteralPath (Join-Path $base 'undoable-cli-latest.tgz') -Destination $file -Force } # a local folder, for testing
    else { Invoke-WebRequest -UseBasicParsing -Uri "$base/undoable-cli-latest.tgz" -OutFile $file }
  } catch {
    Write-Host "Could not download Undoable from $base ($($_.Exception.Message)). Check your internet connection and try again." -ForegroundColor Red
    return
  }
  Write-Host '[ok] Downloaded'

  # 3. Install (npm.cmd, not npm: PowerShell may block npm.ps1 by policy)
  & npm.cmd install -g --no-fund --no-audit $file | Out-Host
  $ok = $LASTEXITCODE -eq 0
  Remove-Item $file -ErrorAction SilentlyContinue
  if (-not $ok) {
    Write-Host 'npm could not install Undoable (see the message above).' -ForegroundColor Red
    return
  }
  Refresh-Path

  # 4. Check
  if (-not (Get-Command undoable -ErrorAction SilentlyContinue)) {
    Write-Host 'Installed, but the undoable command is not found yet. Close this window, open a new PowerShell and run: undoable' -ForegroundColor Yellow
    return
  }
  # Only "undoable 0.9.1": the rest of the line has a dash that Windows PowerShell 5.1 may show garbled.
  $version = (& undoable.cmd 2>$null | Select-Object -First 1)
  if ("$version" -match '^(undoable \S+)') { $version = $Matches[1] }
  Write-Host "[ok] $version" -ForegroundColor Green
  Write-Host ''
  Write-Host 'Next: go to a project your AI agent works on, and run setup there:'
  Write-Host '   cd C:\path\to\your\project' -ForegroundColor Cyan
  Write-Host '   undoable setup' -ForegroundColor Cyan
  Write-Host ''
  Write-Host 'Remove it any time with: undoable remove   then   npm uninstall -g undoable-cli'
}
Install-Undoable
