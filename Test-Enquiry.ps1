param(
  [string]$ProjectRef = "ivlgnrhkubxjlbwvhzpm",
  [string]$Origin = "http://127.0.0.1:5500"
)

$ErrorActionPreference = "Stop"
$FunctionUrl = "https://$ProjectRef.supabase.co/functions/v1/send-enquiry"
$CheckIn = (Get-Date).Date.AddDays(7).ToString("yyyy-MM-dd")
$CheckOut = (Get-Date).Date.AddDays(9).ToString("yyyy-MM-dd")
$Payload = @{
  name = "Rowan House Delivery Test"
  email = "baraknachi987@gmail.com"
  checkin = $CheckIn
  checkout = $CheckOut
  guests = "2 guests"
  room = "Garden Room"
  message = "TEST ONLY: This verifies the Rowan House enquiry email path. No reservation is being requested."
  website = ""
  source_page = "PowerShell delivery test"
} | ConvertTo-Json -Depth 5

Write-Host "Sending one clearly labelled test enquiry to baraknachi987@gmail.com..." -ForegroundColor Cyan
try {
  $Result = Invoke-RestMethod -Uri $FunctionUrl -Method Post -Headers @{ Origin = $Origin } -ContentType "application/json" -Body $Payload
  if (-not $Result.ok) { throw "The function returned ok=false." }
  Write-Host "SUCCESS: Resend accepted the test email." -ForegroundColor Green
  Write-Host "Provider email ID: $($Result.emailId)" -ForegroundColor Cyan
  Write-Host "Now check baraknachi987@gmail.com Inbox and Spam, and the Resend Emails log." -ForegroundColor Yellow
}
catch {
  Write-Host "TEST FAILED: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow }
  throw
}
