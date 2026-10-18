$ErrorActionPreference = 'Stop'
$android = Join-Path $PSScriptRoot '..\native\android'
if (-not (Get-Command gradle -ErrorAction SilentlyContinue)) { throw 'Install Gradle 8.9 and add it to PATH for initial wrapper generation. Afterwards use gradlew.bat.' }
Push-Location $android
try { gradle wrapper --gradle-version 8.9 --distribution-type bin; if ($LASTEXITCODE -ne 0) { throw 'Gradle wrapper generation failed' }; if (-not (Test-Path 'gradle\wrapper\gradle-wrapper.jar')) { throw 'Gradle wrapper jar not generated' } }
finally { Pop-Location }
Write-Host 'Gradle wrapper generated successfully.'
