# Changelog

## 0.10.0-beta.0 — Real Android and iOS builds (unreleased)

- Added a checksum-pinned Gradle 8.9 wrapper so Android builds need no bootstrap step.
- Android: SDK 35, release signing from ignored properties or `MOBIX_*` variables, debug/release APK **and** AAB, hardened manifest, back navigation, state restore, notification permission, and a full bridge (Device, Storage, Navigation, Notifications, SQLite).
- iOS: consolidated SwiftPM `MobixRuntime`, XcodeGen `project.yml`, real simulator `.app` builds, SQLite/notification/navigation plugins, and a `--mobix-smoke-test` bridge check.
- CLI: `build android` now verifies both artifacts and prints size/SHA-256; added `build ios`, `run ios --smoke-test`, expanded `doctor`, and app-ID rewriting in `create`.
- Added `scripts/sync-templates.mjs` plus parity tests so CLI templates stay identical to `native/`.
- Added Android Linux/Windows and macOS iOS CI jobs that build, smoke-test and upload artifacts without committed secrets.
- Bumped all packages, templates and the monorepo to `0.10.0-beta.0`.
- Native artifacts and device tests remain **BLOCKED** in this environment; see [docs/phase-2.md](docs/phase-2.md).

## Unreleased — Phase 1 stabilization

- Added typed events, explicit protocol negotiation, serializable errors and bridge lifecycle cleanup.
- Validated plugin registrations and CLI arguments; guarded web asset synchronization.
- Added tarball integration tests, reproducible dependency locks and Windows/Linux CI.
- Kept package versions at 0.9.0-beta.0; no release published.

## 0.9.0-beta.0 — Open-source preparation (unpublished)

- Added community and governance documentation, GitHub issue and PR templates, package-release checks.
- Bundled CLI project templates into the npm package rather than relying on the repository filesystem.
- Prepared `@mobix/core`, `@mobix/cli` and `@mobix/plugin-sdk` for public beta package publication.
- No new native API completeness claims; Android and iOS binaries remain unverified.

## 0.8.x

- Strengthened bridge input validation and expanded Node.js tests.
