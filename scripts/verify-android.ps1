$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
  if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) { throw 'Set ANDROID_HOME or ANDROID_SDK_ROOT first.' }
  if (-not (Test-Path 'native/android/gradlew.bat')) { throw 'Run scripts/setup-gradle.ps1 first.' }
  if (-not (Test-Path 'native/android/gradle/wrapper/gradle-wrapper.jar')) { throw 'Gradle wrapper jar missing.' }
  npm install; if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
  npm run build; if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
  Push-Location examples/hello-mobix
  try { npm install; if ($LASTEXITCODE -ne 0) { throw 'Example install failed' }; npm run build; if ($LASTEXITCODE -ne 0) { throw 'Example build failed' } }
  finally { Pop-Location }
  $assets = 'native/android/app/src/main/assets/www'
  if (Test-Path $assets) { Remove-Item $assets -Recurse -Force }
  Copy-Item 'examples/hello-mobix/dist' $assets -Recurse
  Push-Location native/android
  try { & .\gradlew.bat --no-daemon assembleDebug; if ($LASTEXITCODE -ne 0) { throw 'Gradle APK build failed' } }
  finally { Pop-Location }
  $apk = 'native/android/app/build/outputs/apk/debug/app-debug.apk'
  if (-not (Test-Path $apk)) { throw 'APK missing after build' }
  Get-FileHash $apk -Algorithm SHA256 | Format-List
  Write-Host "APK VERIFIED: $apk"
  if (Get-Command adb -ErrorAction SilentlyContinue) {
    adb devices
    Write-Host 'To install on connected device: adb install -r native/android/app/build/outputs/apk/debug/app-debug.apk'
  }
} finally { Pop-Location }
