param(
  [string]$ApiBaseUrl = 'http://127.0.0.1:4000'
)

$ErrorActionPreference = 'Stop'

$flutter = 'C:\src\flutter\flutter\bin\flutter.bat'
$root = 'D:\Aeden Bakes'

Write-Host "Checking API build..."
Push-Location "$root\services\api"
npm run build
Pop-Location

Write-Host "Checking super-admin build..."
Push-Location "$root\apps\web\super-admin"
npm run build
Pop-Location

Write-Host "Checking customer app build..."
Push-Location "$root\apps\mobile\customer"
& $flutter build web --dart-define=API_BASE_URL=$ApiBaseUrl
Pop-Location

Write-Host "Checking production app build..."
Push-Location "$root\apps\mobile\production"
& $flutter build web --dart-define=API_BASE_URL=$ApiBaseUrl
Pop-Location

Write-Host "Checking delivery app build..."
Push-Location "$root\apps\mobile\delivery"
& $flutter build web --dart-define=API_BASE_URL=$ApiBaseUrl
Pop-Location

Write-Host "Batch 5.1 release check complete."
