# Native build and device validation

## Android (Windows, macOS, Linux)

Install JDK 17, Android SDK platform 35, build-tools, and Gradle 8.9 (or a verified Gradle wrapper).

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm ci
npm install --prefix examples/hello-mobix
npm run verify:android:build
```

The debug APK and unsigned release AAB must be checked in `native/android/app/build/outputs/`.
An AAB built with `bundleRelease` is **not** store-publishable until properly signed.

For **physical device integration**, enable USB debugging, authorize the host, then run:

```powershell
adb devices
npm run verify:android:device
```

This runs an Android instrumentation test that exercises `Device.getInfo`, `Storage.set`, `Storage.get`, and `Storage.remove` through the JavaScript bridge. Capture the Android test XML reports before declaring it successful. An emulator test is useful but not equivalent to physical-device verification.

## iOS (SwiftPM + xtool)

Reference: https://github.com/crestlancing/xtool (fork of `xtool-org/xtool`, MIT).
Mobix uses **xtool as an external build backend** rather than embedding or modifying it.

Install xtool following its upstream platform guide. On Windows use WSL if required by your xtool distribution. Run `xtool setup` and Apple developer sign-in as requested by xtool.

```bash
npm ci
npm install --prefix examples/hello-mobix
npm run verify:ios:build
```

This invokes `xtool dev build --ipa` when xtool is available. For device installation use `npm run verify:ios:device`, which invokes `xtool dev` (can prompt for pairing and signing). On macOS without xtool, the script compiles for iOS Simulator via `xcrun --sdk iphonesimulator swift build --triple arm64-apple-ios17.0-simulator`, but **does not** claim an IPA.

Do not store developer credentials or signing profiles in source control. App Store submission still needs review, provisioning, signing and separate publishing steps.

## Current environment

This working environment has Node, Java and Swift on Linux, but lacks `ANDROID_HOME`, adb, Gradle, Xcode and xtool. Source generation and TypeScript verification can run here; native compilation or physical-device testing cannot be claimed without their toolchains.
