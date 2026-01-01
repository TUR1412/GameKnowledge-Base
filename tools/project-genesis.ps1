[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string] $RepoUrl = "https://github.com/TUR1412/GameKnowledge-Base.git",

  [Parameter(Mandatory = $false)]
  [string] $RepoDir = "GameKnowledge-Base",

  [Parameter(Mandatory = $false)]
  [string] $Remote = "origin",

  [Parameter(Mandatory = $false)]
  [string] $Branch = "",

  [Parameter(Mandatory = $false)]
  [string] $CommitMessage = "",

  [Parameter(Mandatory = $false)]
  [switch] $SkipInstall,

  [Parameter(Mandatory = $false)]
  [switch] $SkipChecks,

  [Parameter(Mandatory = $false)]
  [switch] $Push,

  [Parameter(Mandatory = $false)]
  [switch] $ForceWithLease,

  [Parameter(Mandatory = $false)]
  [switch] $SelfDestruct
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string] $Message) {
  Write-Host ""
  Write-Host ("== {0} ==" -f $Message) -ForegroundColor Cyan
}

function Assert-Command([string] $Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw ("Missing required command: {0}" -f $Name)
  }
}

function Invoke-External([string] $File, [string[]] $Args) {
  & $File @Args
  if ($LASTEXITCODE -ne 0) {
    throw ("Command failed ({0}): {1} {2}" -f $LASTEXITCODE, $File, ($Args -join " "))
  }
}

Assert-Command "git"
Assert-Command "node"
if (-not $SkipInstall -or -not $SkipChecks) { Assert-Command "npm" }

if ([string]::IsNullOrWhiteSpace($Branch)) {
  $date = Get-Date -Format "yyyyMMdd"
  $Branch = "genesis/$date-1"
}

Write-Step "Prepare repository"
$repoPath = $null
try {
  $repoPath = (Resolve-Path -LiteralPath (Join-Path (Get-Location) $RepoDir) -ErrorAction Stop).Path
} catch {
  $repoPath = $null
}

if (-not $repoPath) {
  Write-Step "Clone"
  Invoke-External "git" @("clone", $RepoUrl, $RepoDir)
  $repoPath = (Resolve-Path -LiteralPath (Join-Path (Get-Location) $RepoDir)).Path
}

Set-Location -LiteralPath $repoPath

Write-Step "Git fetch + checkout branch"
Invoke-External "git" @("fetch", $Remote, "--prune")

$branches = & git branch --list $Branch
if ($LASTEXITCODE -ne 0) { throw "Failed to list git branches." }

if (-not [string]::IsNullOrWhiteSpace($branches)) {
  Invoke-External "git" @("checkout", $Branch)
} else {
  Invoke-External "git" @("checkout", "-b", $Branch)
}

if (-not $SkipInstall) {
  Write-Step "Install (npm ci)"
  Invoke-External "npm" @("ci")
}

Write-Step "Bump version (?v= + data.js.version)"
Invoke-External "node" @("tools/bump-version.mjs")

if (-not $SkipChecks) {
  Write-Step "Quality gate (npm run check:all)"
  Invoke-External "npm" @("run", "check:all")
}

$versionLine = Select-String -Path "data.js" -Encoding UTF8 -Pattern 'version:\s*"([^"]+)"' -AllMatches | Select-Object -First 1
$version = if ($versionLine -and $versionLine.Matches.Count -gt 0) { $versionLine.Matches[0].Groups[1].Value } else { "unknown" }

if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
  $CommitMessage = "feat(genesis): Project Genesis - $version"
}

Write-Step "Commit"
Invoke-External "git" @("add", "-A")

$staged = & git diff --cached --name-only
if ($LASTEXITCODE -ne 0) { throw "Failed to inspect staged changes." }

if ([string]::IsNullOrWhiteSpace($staged)) {
  Write-Host "No staged changes; skip commit."
} else {
  Invoke-External "git" @("commit", "-m", $CommitMessage)
}

if ($Push) {
  Write-Step "Push (safe default: no force)"
  if ($ForceWithLease) {
    Invoke-External "git" @("push", "-u", $Remote, $Branch, "--force-with-lease")
  } else {
    Invoke-External "git" @("push", "-u", $Remote, $Branch)
  }
}

if ($SelfDestruct) {
  if (-not $Push) {
    throw "Refusing -SelfDestruct without -Push (safety guard)."
  }

  Write-Step "SelfDestruct (delete local clone)"
  $target = (Resolve-Path -LiteralPath $repoPath).Path
  $gitDir = Join-Path $target ".git"
  if (-not (Test-Path -LiteralPath $gitDir)) {
    throw ("Refusing to delete because {0} is not a git repo." -f $target)
  }

  $parent = Split-Path -Parent $target
  Set-Location -LiteralPath $parent
  Remove-Item -LiteralPath $target -Recurse -Force
}
