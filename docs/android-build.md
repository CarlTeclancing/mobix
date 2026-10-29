# Android builds

Mobix ships a real Android project in `native/android` (and the identical template in
`packages/cli/templates/android`). The project builds a debug APK + AAB, a release APK + AAB,
and an instrumentation test that exercises the JavaScript bridge.

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| JDK | 17 or newer | Set `JAVA_HOME`; `java -version` must work. |
| Android SDK platform | `android-35` | Required by `compileSdk = 35`. |
| Android build-tools | `35.0.0` (or newer) | AGP picks the default for the platform. |
| Platform-tools | any current | Provides `adb`. |
| Gradle | wrapper 8.9 | Committed; do not install Gradle separately. |

Install the SDK components with Android Studio's SDK Manager or:

```powershell
sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"
```

`scripts/setup-android.ps1` detects a local SDK, writes `native/android/local.properties`
(git-ignored) and can persist `ANDROID_HOME`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-android.ps1 -Install -Persist
```

## Build

From the repository root:

```powershell
npm run build                                  # TypeScript packages
npm install --prefix examples/hello-mobix
node scripts/native-pipeline.mjs android build
```

or, from a generated Mobix app:

```bash
npm run build
npx mobix build android            # debug APK + AAB
npx mobix build android --release  # release APK + AAB
```

`mobix build android` performs, in order:

1. SDK discovery (`ANDROID_HOME`, `ANDROID_SDK_ROOT`, `local.properties`, then common install paths).
2. Checks for `android-35` and Java 17+.
3. Writes `local.properties`.
4. Runs the web build and synchronizes `webDir` into `app/src/main/assets/www`.
5. Runs `gradlew assembleDebug bundleDebug` (or the release variants).
6. Verifies that both artifacts exist and prints size and SHA-256.

Artifacts:

```
native/android/app/build/outputs/apk/debug/app-debug.apk
native/android/app/build/outputs/bundle/debug/app-debug.aab
native/android/app/build/outputs/apk/release/app-release.apk
native/android/app/build/outputs/bundle/release/app-release.aab
```

Release artifacts are unsigned unless signing is configured; see [signing.md](signing.md).
The debug variants are signed with the local debug key and are not store-publishable.

## Install and launch

With exactly one authorized device or emulator:

```bash
adb devices
npx mobix run android
```

The CLI builds, installs, force-stops, starts `MainActivity` and verifies the process ID.
For the lower-level flow:

```powershell
node scripts/native-pipeline.mjs android device   # build + connectedDebugAndroidTest
npm run verify:device                             # install/launch only
```

The instrumentation test (`BridgeInstrumentedTest`) drives `Bridge.negotiate`,
`Device.getInfo`, `Storage.set/get/remove` and SQLite through the same JavaScript bridge the
app uses. Debug builds also expose `runBridgeSmokeTest`, which posts a self-check to
`window.__mobixReceive` and reports `PASS` or an error string.

## Runtime notes

- Assets are served from `https://appassets.androidplatform.net/assets/www/index.html` via
  `WebViewAssetLoader`. Cleartext HTTP and mixed content are disabled.
- The bridge only accepts main-frame messages from that exact origin. Requests are capped at
  64 KiB; IDs at 128 characters.
- `SQLite.execute` accepts one statement without `;` and only
  `INSERT|UPDATE|DELETE|CREATE TABLE|CREATE INDEX|DROP TABLE`; `SQLite.query` accepts
  `SELECT` and caps results at 1000 rows.
- `Navigation.openExternal` only opens `http(s)` URLs.
- Back navigates web history first, then finishes the activity. WebView state is saved and
  restored across configuration changes/process death.
- Debug builds enable WebView debugging; release builds do not.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Android SDK platform android-35 is missing` | `sdkmanager "platforms;android-35"` or install API 35 in Android Studio. |
| `Java 17+ is required` | Install a JDK 17 and point `JAVA_HOME` at it; restart the terminal. |
| `sdkmanager` missing | Android Studio → SDK Tools → Android SDK Command-line Tools. |
| `SDK location not found` | Run `scripts/setup-android.ps1`, or set `ANDROID_HOME`. |
| `No authorized Android device` | `adb devices`; accept the USB debugging prompt; start an emulator. |
| Build works but app shows a blank page | Run `mobix sync android` after `npm run build`; check `adb logcat -s Mobix`. |
| AAB rejected by Play Console | Configure release signing (debug AABs are not uploadable). |

`mobix doctor` prints every check above without building anything.
