# Native build and device validation

## Android (Windows, macOS, Linux)

Install JDK 17 and Android SDK platform 35 + build-tools (platform-tools for devices).
The repository ships a pinned Gradle 8.9 wrapper; no separate Gradle install is needed.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-android.ps1 -Install -Persist
npm ci
npm install --prefix examples/hello-mobix
node scripts/native-pipeline.mjs android build
```

Expected artifacts:

```
native/android/app/build/outputs/apk/debug/app-debug.apk
native/android/app/build/outputs/bundle/debug/app-debug.aab
```

The pipeline verifies both files exist and records size + SHA-256 in
`reports/pipeline-android-build.json`. A missing artifact fails the command.

For **device integration**, enable USB debugging, authorize the host, then run:

```powershell
adb devices
node scripts/native-pipeline.mjs android device
```

This builds the APK/AAB, runs `connectedDebugAndroidTest` (one authorized device required) and,
with `npm run verify:device`, installs/launches the app and checks the PID. Capture the
instrumentation XML reports before declaring success. An emulator run is useful but is not
equivalent to a physical device.

Release builds use `bundleRelease`/`assembleRelease`. They are unsigned until
`android/keystore.properties` or the `MOBIX_*` environment variables are set; see
[signing.md](signing.md). An unsigned AAB is not store-publishable.

## iOS (XcodeGen + Xcode, or xtool)

Reference: https://github.com/crestlancing/xtool (fork of `xtool-org/xtool`, MIT).
Mobix uses xtool as an external build backend.

### macOS

```bash
brew install xcodegen
npm ci
npm install --prefix examples/hello-mobix
node scripts/native-pipeline.mjs ios build
node scripts/native-pipeline.mjs ios device
```

The build generates `native/ios/MobixApp.xcodeproj` and a simulator `.app` under
`native/ios/build/Build/Products/Debug-iphonesimulator/`. The device mode boots a simulator,
installs the app, launches it with `--mobix-smoke-test`, waits for
`Documents/mobix-smoke.txt` and requires `PASS`.

### xtool (Apple signing required)

```bash
xtool setup
xtool auth login
cd native/ios
xtool dev build --ipa
```

`mobix build ios` invokes this automatically when Xcode is absent but xtool is on `PATH`.
Signing identities and profiles belong to the contributor.

Do not store developer credentials or signing profiles in source control. App Store
submission still needs review, provisioning, signing and separate publishing steps.

## Current environment (2026-10-29)

Node 22 is available. The Android SDK exists but only contains platform `android-36`, there is
no JDK and no `sdkmanager`; no Android device is connected. This is a Windows host without
Xcode/XcodeGen/xtool. See [phase-2.md](phase-2.md) and [VERIFICATION.md](../VERIFICATION.md)
for the BLOCKED evidence.
