param(
    [switch]$Device
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
    & node scripts/native-pipeline.mjs android build
    if ($LASTEXITCODE -ne 0) { throw 'Android build verification failed. See reports\pipeline-android-build.json.' }
    if ($Device) {
        & node scripts/native-pipeline.mjs android device
        if ($LASTEXITCODE -ne 0) { throw 'Android device verification failed. See reports\pipeline-android-device.json.' }
    }
    Write-Host "APK/AAB: native\android\app\build\outputs\apk\debug and native\android\app\build\outputs\bundle\debug"
}
finally { Pop-Location }
