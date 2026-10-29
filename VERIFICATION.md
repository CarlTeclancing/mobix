# Mobix verification results (2026-10-29)

Environment: Windows, Node v22.19.0, Android SDK at
`C:\Users\HP-360\AppData\Local\Android\Sdk` (platform `android-36`, build-tools `36.1.0`,
`adb`; no `android-35`, no `sdkmanager`, no JDK). No macOS/Xcode/XcodeGen/xtool and no
connected Android device.

## Executed in this environment

| Command | Result |
| --- | --- |
| `npm run build` | PASS — core + CLI TypeScript builds. |
| `npm test` | PASS — 27/27 tests, including native/template parity, manifest policy, CI invariants, SDK discovery and artifact hashing. |
| `npm run check` | PASS — build + tests + package checks at `0.10.0-beta.0`. |
| `npm run verify:starter` | PASS — packed tarballs installed into a temporary project, Vite built 27 modules, both native syncs succeeded. |
| `node scripts/native-pipeline.mjs android check` | FAIL/BLOCKED — 3/5: SDK, build-tools and wrapper pass; platform 35 missing, Java missing. |
| `node scripts/native-pipeline.mjs ios check` | FAIL/BLOCKED — 2/3: SwiftPM project and XcodeGen spec present; no build backend. |
| `node packages/cli/dist/index.js doctor` | Reports the same gaps and no connected devices. |
| `adb devices` | No devices. |
| Android APK/AAB | **NOT PRODUCED** — blocked by missing JDK + platform 35. |
| Android install/launch + instrumentation | **NOT EXECUTED** — no device/emulator. |
| iOS `.app`/IPA | **NOT PRODUCED** — no macOS/Xcode/xtool. |
| Remote CI | **NOT RUN** from this checkout. |

## Reproduce on a provisioned machine

Android (Windows/macOS/Linux):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-android.ps1 -Install -Persist
node scripts/native-pipeline.mjs android build    # APK + AAB, writes reports/pipeline-android-build.json
node scripts/native-pipeline.mjs android device   # requires exactly one authorized device
```

iOS (macOS with Xcode + XcodeGen):

```bash
brew install xcodegen
node scripts/native-pipeline.mjs ios build
node scripts/native-pipeline.mjs ios device       # simulator + bridge smoke test
```

Expected artifacts:

- `native/android/app/build/outputs/apk/debug/app-debug.apk`
- `native/android/app/build/outputs/bundle/debug/app-debug.aab`
- `native/ios/build/Build/Products/Debug-iphonesimulator/MobixApp.app`

## Caveats

- The Android bridge smoke test and instrumentation are code-complete but have never run on a
  device in this environment.
- The iOS smoke test writes `Documents/mobix-smoke.txt`; CI asserts it contains `PASS`.
- Release AABs are unsigned unless signing is configured; unsigned bundles are not
  store-publishable.
- Do not claim production readiness from these scripts alone.
