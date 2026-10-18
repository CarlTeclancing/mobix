# Mobix verification results (2026-10-18)

## Executed in this environment
- `npm run build`: PASS (core + CLI). CLI Node types were supplied locally for offline compilation; on a normal connected workstation run `npm install --prefix packages/cli`.
- `npm test`: PASS (3/3 tests).
- `npm run verify:native:android`: BLOCKED. Java available, but adb and Gradle wrapper executable/JAR missing. No APK or AAB compiled.
- `npm run verify:native:ios`: BLOCKED. xcodebuild unavailable and no complete Xcode project. No IPA compiled.
- Physical-device verification: NOT EXECUTED (no connected device).

## Windows Android validation
1. Install Node.js 22, JDK 17, Android Studio, Android SDK platform 35, Android build tools, platform-tools; set ANDROID_HOME and JAVA_HOME.
2. Install dependencies in core, CLI and sample project (`npm install` in each). Run `npm run build` from repository root.
3. Bootstrap Gradle wrapper using `scripts/setup-gradle.ps1` and installed Gradle. The wrapper JAR is NOT included in this archive.
4. Run `npm run verify:native:android`. Fix any reported failures and preserve `reports/android-verification.json`.
5. Enable USB debugging on your Android device, authorize computer, then run `npm run verify:device` after a successful debug APK build.
6. Manually exercise Device.getInfo and Storage set/get/remove, navigation, rotation, resume and denial handling; save logcat and screenshots.

## macOS iOS validation
- An actual Xcode project must first be implemented. The existing Swift controller alone cannot produce an IPA.
- After Xcode project generation, use `xcodebuild` on macOS, run on a simulator and physical device, then validate signing and archive export.

## Caveats
- The smoke test only confirms install/launch, not native bridge behavior.
- `bundleRelease` produces an AAB that may still be unsigned; publishing requires release signing and store validation.
- Do not claim Android or iOS production readiness from these scripts alone.
