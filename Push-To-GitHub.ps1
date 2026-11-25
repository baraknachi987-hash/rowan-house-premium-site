$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$Owner = "baraknachi987-hash"
$RepoName = "rowan-house-premium-site"
$FullName = "$Owner/$RepoName"
Set-Location $ProjectRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed. Install it with: winget install --id Git.Git -e ; then reopen PowerShell."
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI is not installed. Install it with: winget install --id GitHub.cli -e ; then reopen PowerShell."
}

# Confirm the user is authenticated before making a public repository.
gh auth status
if ($LASTEXITCODE -ne 0) {
  gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { throw "GitHub authentication failed." }
}

if (-not (Test-Path (Join-Path $ProjectRoot "site\index.html"))) {
  throw "Run this script from the extracted Rowan House project folder. site\index.html was not found."
}

# Set a local Git identity if this machine has not been configured yet.
if ([string]::IsNullOrWhiteSpace((git config user.name))) {
  $GitName = Read-Host "Git author name for this repository"
  if ([string]::IsNullOrWhiteSpace($GitName)) { throw "A Git author name is required." }
  git config user.name $GitName
}
if ([string]::IsNullOrWhiteSpace((git config user.email))) {
  $GitEmail = Read-Host "Git author email for this repository"
  if ([string]::IsNullOrWhiteSpace($GitEmail)) { throw "A Git author email is required." }
  git config user.email $GitEmail
}

if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
  git init --initial-branch=main
  if ($LASTEXITCODE -ne 0) { throw "git init failed." }
}

git add --all
if ($LASTEXITCODE -ne 0) { throw "git add failed." }
$staged = git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
  git commit -m "Build premium Rowan House website and enquiry backend"
  if ($LASTEXITCODE -ne 0) { throw "git commit failed." }
} elseif ($LASTEXITCODE -gt 1) { throw "Unable to inspect staged changes." }

# Stop rather than overwrite a pre-existing repository.
gh repo view $FullName *> $null
if ($LASTEXITCODE -eq 0) {
  throw "Repository $FullName already exists. Inspect it first; this script will not overwrite it. Change `$RepoName in this script if you want a different new repository."
}

gh repo create $FullName --public --source . --remote origin
if ($LASTEXITCODE -ne 0) { throw "GitHub repository creation failed." }

# Enable Pages with GitHub Actions before the first push.
gh api --method POST "repos/$FullName/pages" -f build_type=workflow *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Warning "Could not enable GitHub Pages automatically. After pushing, open Settings > Pages and set Source to GitHub Actions."
}

git push -u origin main
if ($LASTEXITCODE -ne 0) { throw "Push failed. Check the GitHub CLI login and remote status." }

Write-Host "Pushed: https://github.com/$FullName" -ForegroundColor Green
Write-Host "The Actions workflow will publish the contents of /site to GitHub Pages." -ForegroundColor Cyan
Write-Host "When deployment succeeds, your URL should be: https://$Owner.github.io/$RepoName/" -ForegroundColor Yellow
Write-Host "If the Pages workflow reports that Pages is disabled, set Settings > Pages > Source = GitHub Actions, then rerun the workflow."
