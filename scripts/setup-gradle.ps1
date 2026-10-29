param(
    [switch]$Regenerate
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$android = Join-Path $root 'native\android'
$jar = Join-Path $android 'gradle\wrapper\gradle-wrapper.jar'
$script = Join-Path $android 'gradlew.bat'

if (-not $Regenerate) {
    if (-not (Test-Path $jar)) { throw "Gradle wrapper JAR missing: $jar. Restore it from git or run with -Regenerate." }
    if (-not (Test-Path $script)) { throw "gradlew.bat missing: $script. Restore it from git or run with -Regenerate." }
    $hash = (Get-FileHash $jar -Algorithm SHA256).Hash
    Write-Host "Gradle wrapper present (gradle-wrapper.jar sha256=$hash)."
    Write-Host 'No bootstrap step is required; the wrapper downloads Gradle 8.9 on first use.'
    exit 0
}

if (-not (Get-Command gradle -ErrorAction SilentlyContinue)) {
    throw 'Install Gradle 8.9 and add it to PATH to regenerate the wrapper.'
}
Push-Location $android
try {
    & gradle wrapper --gradle-version 8.9 --distribution-type bin
    if ($LASTEXITCODE -ne 0) { throw 'Gradle wrapper generation failed' }
    if (-not (Test-Path $jar) -or -not (Test-Path $script)) { throw 'Gradle wrapper files were not generated' }
}
finally { Pop-Location }
Write-Host 'Gradle wrapper regenerated.'
