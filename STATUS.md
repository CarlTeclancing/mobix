# Mobix v0.10.0-beta.0 status

## Implemented and locally verified

- TypeScript core and CLI build and all **27** automated tests pass (`npm run check`).
- Packed core/CLI tarballs install into a clean temporary project, build the Vite app and sync
  both native platforms (`npm run verify:starter`).
- Canonical Android/iOS projects and CLI templates are byte-identical (enforced by tests).
- Android project is complete: Gradle 8.9 wrapper, SDK 35 config, APK + AAB tasks, release
  signing hooks, hardened manifest, back/state handling, and a bridge covering Device, Storage,
  Navigation, Notifications and SQLite.
- iOS project is complete: SwiftPM `MobixRuntime`, XcodeGen spec, real simulator `.app` path,
  the same plugin set, and a simulator bridge smoke test.
- CI workflow builds Android on Linux and Windows and the iOS simulator app on macOS, then
  uploads artifacts.

## Blocked in this environment

- **No Android artifact was produced.** Java is not installed and the local SDK only has
  platform `android-36`, not `android-35`; less than 1 GB of free disk made installing both
  unsafe. `node scripts/native-pipeline.mjs android check` reports 3/5 checks (SDK, build-tools
  and wrapper pass).
- **No Android device/emulator is connected**, so install/launch and instrumentation are
  unverified.
- **No iOS artifact was produced.** This is a Windows host without Xcode, XcodeGen or xtool.
- **Remote CI has not been executed** from this checkout; the workflow definitions are
  committed but their first real run is still pending.

Nothing above is claimed as passing. See [docs/phase-2.md](docs/phase-2.md) for the full
evidence table and [VERIFICATION.md](VERIFICATION.md) for the command output summary.
