# Phase 2: deliver real Android and iOS builds

## Audit before changes

The v0.9.0-beta.0 checkout could not produce a native artifact:

- Android had no Gradle wrapper (`gradlew`, `gradlew.bat`, `gradle-wrapper.jar`), no release signing path, no AAB task, `versionName = "0.6"`, no back-navigation handling, no state restore, no notification permission handling and a placeholder asset page that called an undefined `MobixNative` object.
- iOS had a single Swift file under `Sources/MobixApp`, duplicated in `MobixRuntime`, with a WKWebView message-handler retain cycle, no SQLite/notification/navigation plugins, no XcodeGen project spec and therefore no way to produce a real `.app` or `.ipa`.
- The CLI only ran `assembleDebug`, never verified that an artifact existed, had no SDK/Java diagnostics, no iOS simulator launch and no bridge smoke test.
- Scripts and CI described commands that did not match the repository (missing wrapper, missing Xcode project, `verify:device` expected a non-existent APK), and no CI job produced an uploadable artifact.

## Version

All packages, templates and the monorepo move together to **0.10.0-beta.0**. `scripts/check-packages.mjs` now fails if any package or the starter template drifts from the root version.

## Android implementation

- Committed a real Gradle 8.9 wrapper with a SHA-256-pinned distribution (`d725d707…cecab`) so a clean checkout needs no bootstrap step.
- `native/android/app/build.gradle.kts`: compile/target SDK 35, Java 17, explicit version code/name, `bundleDebug`/`bundleRelease` support, and opt-in release signing from `android/keystore.properties` or `MOBIX_KEYSTORE_FILE`, `MOBIX_KEYSTORE_PASSWORD`, `MOBIX_KEY_ALIAS`, `MOBIX_KEY_PASSWORD`. An unsigned release build is allowed but prints a warning.
- `AndroidManifest.xml`: `usesCleartextTraffic="false"`, `allowBackup="false"`, predictive back enabled, `singleTask` launch mode, configuration-change handling for rotation, and `POST_NOTIFICATIONS`.
- `MainActivity.kt`: secure `WebViewAssetLoader` origin (`https://appassets.androidplatform.net`), `WebViewCompat` message listener with main-frame/origin checks, 64 KiB request limit, `Bridge.negotiate`, `Device.getInfo`, `Storage.*`, `Navigation.openExternal`, `Notifications.show`, `SQLite.execute/query` with statement allow-listing and a 1000-row cap, back navigation, `onSaveInstanceState`, notification permission request, and a debug-only bridge smoke test.
- Placeholder asset pages now use `window.mobixBridge.postMessage` and a real request envelope.

## iOS implementation

- Consolidated the runtime into a single SwiftPM `MobixRuntime` target (deleted the duplicated `Sources/MobixApp/MobixWebViewController.swift`).
- `MobixWebViewController.swift`: scoped file origin, main-frame checks, weak message handler to break the retain cycle, `Bridge.negotiate`, `Device`, `Storage`, `Navigation`, `Notifications`, `SQLite`, back gesture support, content-process recovery, and a `--mobix-smoke-test` launch argument that writes `Documents/mobix-smoke.txt` and exits 0/1.
- `MobixDatabase.swift`: dependency-free SQLite3 wrapper with the same validation and row limits as Android.
- `project.yml` (XcodeGen): real iOS application target using `Sources/MobixApp` + `MobixRuntime`, resource copy of `www`, `libsqlite3.tbd`, deployment target iOS 17.
- `Package.swift`: SwiftPM library (`MobixRuntime`) plus executable (`MobixApp`) for cross-platform compilation.
- `xtool.yml` remains as the optional IPA backend for contributors with Apple signing configured.

## CLI implementation

| Command | Behaviour |
| --- | --- |
| `mobix create <name>` | Copies the web, Android and iOS templates; rewrites app ID, display name and bundle ID; pins `@mobix/core` / `@mobix/cli` to the CLI version. |
| `mobix sync android\|ios` | Validates config and copies `webDir` with symlink/escape protection. |
| `mobix build android [--release]` | Discovers the SDK (env, `local.properties`, common install paths), checks platform 35 and Java 17+, writes `local.properties`, runs web build + sync + `assemble<Variant> bundle<Variant>`, then verifies both artifacts exist and prints size and SHA-256. |
| `mobix build ios` | XcodeGen + `xcodebuild` simulator `.app` on macOS, else `xtool dev build --ipa`, else SwiftPM compile only (reported as BLOCKED, not as an artifact). |
| `mobix run android` | Builds, requires exactly one authorized device, installs, force-stops, starts `MainActivity` and verifies the PID. |
| `mobix run ios [--smoke-test]` | Installs and launches on a booted simulator; with `--smoke-test` waits for `Documents/mobix-smoke.txt` and fails unless it contains `PASS`. |
| `mobix doctor` | Reports SDK source, platforms, build-tools, adb, sdkmanager, devices, Java, wrapper, Xcode/XcodeGen/xtool and bundle ID. Informational only. |
| `mobix clean` | Removes Android and iOS build output. |

`src/android.ts` and `src/ios.ts` contain the testable toolchain logic. `scripts/sync-templates.mjs` regenerates the shipped CLI templates from the canonical `native/` projects, and `tests/native-projects.test.mjs` fails if they diverge.

## Verification commands

```powershell
npm run sync:templates
npm run check
npm run verify:starter
node scripts/native-pipeline.mjs android check
node scripts/native-pipeline.mjs ios check
node packages/cli/dist/index.js doctor
```

On a machine with the toolchains, the acceptance commands are:

```powershell
node scripts/native-pipeline.mjs android build    # writes reports/pipeline-android-build.json
node scripts/native-pipeline.mjs android device   # emulator/device instrumentation
node scripts/native-pipeline.mjs ios build        # macOS
node scripts/native-pipeline.mjs ios device       # macOS simulator + bridge smoke test
```

Artifact paths:

- APK: `native/android/app/build/outputs/apk/debug/app-debug.apk` (release: `…/apk/release/`)
- AAB: `native/android/app/build/outputs/bundle/debug/app-debug.aab` (release: `…/bundle/release/`)
- iOS app: `native/ios/build/Build/Products/Debug-iphonesimulator/MobixApp.app`
- IPA: produced by xtool in the path it reports (the CLI prints it)

## Verification evidence (Windows, 2026-10-29, Node v22.19.0)

| Command | Result |
| --- | --- |
| `npm run check` | PASS — TypeScript builds; **27/27 tests pass**; all three packages and the monorepo report `0.10.0-beta.0`. |
| `npm run verify:starter` | PASS — packed core/CLI installed into a temporary project, Vite built 27 modules, both native syncs succeeded, generated `package.json` unchanged. |
| `npm run release:dry-run` | PASS — `@mobix/core` 5 files, `@mobix/cli` 34 files, `@mobix/plugin-sdk` 5 files, all at `0.10.0-beta.0`. |
| `node scripts/native-pipeline.mjs android check` | FAIL/BLOCKED — `3/5` checks. SDK found at `C:\Users\HP-360\AppData\Local\Android\Sdk` (via `local.properties` after the first run; `LOCALAPPDATA` before that), build-tools `36.1.0`, wrapper OK; platform `android-35` absent (only `android-36`), Java not installed. |
| `node scripts/native-pipeline.mjs ios check` | FAIL/BLOCKED — `2/3`. SwiftPM project and XcodeGen spec present; no Xcode, XcodeGen or xtool backend. |
| `node packages/cli/dist/index.js doctor` | Reports the same gaps: missing platform 35, sdkmanager, Java, no devices, no iOS backend. |
| Android APK/AAB | **BLOCKED** — no JDK and no Android platform 35; `<1 GB` free disk made installing them unsafe. No artifact was produced locally. |
| Android install/launch + instrumentation | **BLOCKED** — `adb devices` shows no device/emulator. |
| iOS `.app`/IPA | **BLOCKED** — requires macOS + Xcode/XcodeGen or xtool with Apple signing. |
| Remote CI | Not executed from this machine; workflow definitions are committed and lint-checked by tests. |

No native artifact, device launch or IPA is claimed. The code paths are complete, but Phase 2 acceptance is only fully met once the CI jobs or a provisioned workstation produce the artifacts above.

## Acceptance checklist

| Criterion | Status | Evidence |
| --- | --- | --- |
| Real Android project builds APK + AAB | **BLOCKED locally** | Wrapper present, `assemble*/bundle*` wired, artifact hashing tested with fixtures; requires JDK 17 + platform 35. |
| APK installs and launches | **BLOCKED** | `mobix run android` implements install/launch/PID check; no connected device here. |
| Sample app calls native bridge on Android | **BLOCKED** | Debug smoke test + instrumentation test implemented; cannot run without toolchain/device. |
| Real iOS `.app`/`.ipa` | **BLOCKED locally, implemented for macOS CI** | XcodeGen spec + SwiftPM runtime + `xcodebuild` path; macOS runner job builds and uploads `.app`. |
| iOS launches and bridge smoke passes | **BLOCKED locally** | Simulator install/launch + `--mobix-smoke-test` implemented; CI job asserts `PASS`. |
| No credentials or private keys committed | PASS | `.gitignore` covers keystores, profiles, `keystore.properties`, `local.properties`; tests assert no secrets in build files/CI. |
| Reproducible CI | PASS (definition) | Pinned Node 22, JDK 17, Gradle wrapper 8.9, SHA-256-pinned distribution; three jobs upload artifacts. |
| Honest reporting | PASS | This document labels every unverified item BLOCKED rather than passing. |

## File-level change summary

| Files | Change |
| --- | --- |
| `native/android/gradlew`, `gradlew.bat`, `gradle/wrapper/*` | Real Gradle 8.9 wrapper, checksum-pinned distribution |
| `native/android/app/build.gradle.kts` | SDK 35, signing config, version, release build types |
| `native/android/app/src/main/AndroidManifest.xml` | Security, back callback, rotation, notifications |
| `native/android/app/src/main/java/dev/mobix/prototype/MainActivity.kt` | Full bridge, plugins, lifecycle, smoke test |
| `native/android/app/src/main/assets/www/index.html` | Working bridge demo page |
| `native/android/keystore.properties.example`, `.gitignore` | Signing template and secret exclusions |
| `native/ios/MobixRuntime/MobixWebViewController.swift` | Consolidated WKWebView runtime and bridge |
| `native/ios/MobixRuntime/MobixDatabase.swift` | SQLite3 implementation |
| `native/ios/Package.swift`, `project.yml`, `xtool.yml` | SwiftPM, XcodeGen and xtool build definitions |
| `native/ios/Sources/MobixApp/MobixApp.swift`, `www/index.html` | SwiftUI host and demo asset |
| `packages/cli/src/android.ts` | SDK discovery, Java check, wrapper, artifacts, hashing |
| `packages/cli/src/ios.ts` | Xcode/xtool/Simulator/smoke logic |
| `packages/cli/src/index.ts` | `create/build/run/doctor/clean`, version and app-ID rewriting |
| `packages/cli/templates/**` | Regenerated from `native/` |
| `scripts/native-pipeline.mjs`, `verify-native.mjs`, `device-smoke-test.mjs`, `verify-android.ps1` | Real check/build/device flows and JSON reports |
| `scripts/setup-android.ps1`, `setup-gradle.ps1` | SDK detection/persistence and wrapper verification |
| `scripts/sync-templates.mjs`, `check-packages.mjs` | Template parity and version consistency |
| `tests/native-projects.test.mjs`, `cli-create.test.mjs`, `packaging.test.mjs` | Parity, security, CI, SDK and artifact tests |
| `.github/workflows/mobile-build.yml` | Android Linux emulator, Android Windows, macOS iOS jobs |
| `.gitignore`, package manifests/locks | Secret/build exclusions, 0.10.0-beta.0 |
| `README.md`, `CHANGELOG.md`, `STATUS.md`, `VERIFICATION.md`, `docs/*` | Phase 2 documentation |

## Follow-up issue suggestions

- **Verify Android artifacts on real hardware:** acceptance = CI or workstation produces APK + AAB, installs on a physical device, instrumentation passes and logcat/screenshots are archived.
- **Verify iOS signing and TestFlight upload:** acceptance = an Apple developer account signs the IPA, installs on a physical device and uploads to TestFlight without committing credentials.
- **Add iOS unit tests for `MobixDatabase`:** the SQLite wrapper is only exercised through the simulator smoke test today.
- **Cache Gradle in CI:** first-run dependency downloads dominate the Android job; add a cache keyed on wrapper/build files.
- **Add artifact attestation:** publish SHA-256 sums and optionally Sigstore attestations with each release.

Proposed commit: `feat: deliver real Android and iOS build pipelines`
