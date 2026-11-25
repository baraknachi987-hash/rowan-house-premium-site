param(
  [string]$ProjectRef = "ivlgnrhkubxjlbwvhzpm",
  [string]$AllowedOrigins = "http://127.0.0.1:5500,http://localhost:5500,https://baraknachi987-hash.github.io"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 20+ is required. Install it, then reopen PowerShell."
}
if (-not (Test-Path (Join-Path $ProjectRoot "supabase\functions\send-enquiry\index.ts"))) {
  throw "The Supabase Edge Function source was not found. Extract the complete project ZIP first."
}
if (-not (Test-Path (Join-Path $ProjectRoot "site\script.js"))) {
  throw "site\script.js was not found. Run this script from the project root."
}

Write-Host "ROWAN HOUSE — EMAIL BACKEND SETUP" -ForegroundColor Cyan
Write-Host "Supabase project: $ProjectRef" -ForegroundColor Yellow
Write-Host "Recipient: baraknachi987@gmail.com" -ForegroundColor Yellow
Write-Host "Do not paste the Resend key into chat or commit it to GitHub." -ForegroundColor Yellow

$SecureKey = Read-Host "Resend API key (hidden input)" -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureKey)
try { $ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR) }
$FromEmail = Read-Host "Sender (press Enter to use Resend test sender onboarding@resend.dev)"
if ([string]::IsNullOrWhiteSpace($FromEmail)) { $FromEmail = "The Rowan House <onboarding@resend.dev>" }
if ([string]::IsNullOrWhiteSpace($ApiKey) -or $FromEmail.Contains("`n") -or $FromEmail.Contains("`r")) {
  throw "A valid Resend API key is required; sender must be a single line."
}

$SecretFile = Join-Path $ProjectRoot "supabase\.rowan-secrets.tmp"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$SecretLines = @(
  "RESEND_API_KEY=$ApiKey",
  "ENQUIRY_TO_EMAIL=baraknachi987@gmail.com",
  "ENQUIRY_FROM_EMAIL=$FromEmail",
  "ALLOWED_ORIGINS=$AllowedOrigins"
)
[System.IO.File]::WriteAllLines($SecretFile, $SecretLines, $Utf8NoBom)

try {
  Write-Host "Signing in to Supabase CLI. Complete browser sign-in if prompted..." -ForegroundColor Cyan
  npx --yes supabase@v2.stable login
  if ($LASTEXITCODE -ne 0) { throw "Supabase login failed." }

  Write-Host "Saving email credentials as Supabase Function secrets..." -ForegroundColor Cyan
  npx --yes supabase@v2.stable secrets set --env-file $SecretFile --project-ref $ProjectRef --yes
  if ($LASTEXITCODE -ne 0) { throw "Supabase secret upload failed. The local temporary file is ignored by Git; do not share it." }

  Write-Host "Deploying the enquiry function..." -ForegroundColor Cyan
  npx --yes supabase@v2.stable functions deploy send-enquiry --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw "Edge Function deployment failed. Check the Supabase CLI output." }

  $FunctionUrl = "https://$ProjectRef.supabase.co/functions/v1/send-enquiry"
  $SiteScript = Join-Path $ProjectRoot "site\script.js"
  $SiteCode = [System.IO.File]::ReadAllText($SiteScript)
  $SiteCode = [regex]::Replace($SiteCode, '(?m)(enquiryEndpoint:\s*)"[^"]+"', ('$1"' + $FunctionUrl + '"'), 1)
  [System.IO.File]::WriteAllText($SiteScript, $SiteCode, $Utf8NoBom)

  Remove-Item -LiteralPath $SecretFile -Force
  $ApiKey = $null
  Write-Host "SUCCESS: Supabase secrets saved and send-enquiry deployed." -ForegroundColor Green
  Write-Host "Function URL: $FunctionUrl" -ForegroundColor Cyan
  Write-Host "Next, run .\Test-Enquiry.ps1 and check Gmail Inbox/Spam plus Resend logs." -ForegroundColor Yellow
}
catch {
  $ApiKey = $null
  Write-Error $_
  throw
}
