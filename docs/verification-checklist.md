# Release verification checklist

## Automated (every change)

1. `npm run sync:templates` after any edit under `native/`.
2. `npm run check` — build, 27 Node tests, package/version checks.
3. `npm run verify:starter` — packed tarballs, Vite build, both native syncs.
4. `npm run release:dry-run` for package contents.

## Windows/Linux Android host

1. Install JDK 17 and Android SDK platform 35 + build-tools + platform-tools.
2. Run `npm run setup:android` (adds `local.properties`) and `mobix doctor`.
3. `node scripts/native-pipeline.mjs android build`; record APK/AAB hashes from the output and
   `reports/pipeline-android-build.json`.
4. `adb devices`, then `node scripts/native-pipeline.mjs android device`; capture the
   instrumentation XML report.
5. Manually check Device.getInfo, Storage round-trip, rotation, process death, Android back,
   permission denial and malicious external navigation.
6. `mobix run android` must install, launch and report a PID.

## macOS iOS host

1. `brew install xcodegen`; confirm Xcode 15+ and at least one iPhone simulator.
2. `node scripts/native-pipeline.mjs ios build`; confirm
   `native/ios/build/Build/Products/Debug-iphonesimulator/MobixApp.app`.
3. `node scripts/native-pipeline.mjs ios device`; confirm the smoke result is `PASS`.
4. For hardware/IPA: configure xtool or Xcode signing, install on a device, and test lifecycle,
   keyboard, back gesture, notifications and external links.

## Before a release

- Confirm the version is identical in root `package.json`, all packages and the starter template.
- Verify no `keystore.properties`, `local.properties`, `.p12`, `.mobileprovision` or `.env` is
  tracked (`git status`, `git ls-files`).
- Archive artifact SHA-256 values and device logs.
- Do not claim store readiness until a signed artifact has been uploaded and reviewed.

## Cloud builds

Provision authenticated isolated workers, secret manager, build queue, artifact storage,
retention, quotas, audit logs and billing before enabling remote builds.

No physical device or native build verification has been performed in this environment; see
[phase-2.md](phase-2.md).
