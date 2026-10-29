# Development setup

## Requirements

- Node.js 20+ and npm
- TypeScript compiler (installed via package devDependencies)
- For Android: JDK 17, Android SDK platform 35, build-tools, and a device or emulator.
  The Gradle 8.9 wrapper is committed; do not install Gradle separately.
- For iOS: macOS with Xcode 15+ and XcodeGen, or xtool with Apple signing.

## Run checks

```bash
npm install --prefix packages/core
npm install --prefix packages/cli
npm run build
npm test
npm run check
npm run release:dry-run
npm run verify:starter
```

The CLI's `create` command uses templates under `packages/cli/templates`. Those templates are
generated from `native/`; run `npm run sync:templates` after editing a native project and
commit both copies. `tests/native-projects.test.mjs` fails if they diverge.

Run `npm run build` before invoking `node packages/cli/dist/index.js create test-app` in a
temporary directory.

## Android

See [android-build.md](android-build.md) and [BUILD-VALIDATION.md](BUILD-VALIDATION.md).

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-android.ps1 -Install -Persist
node scripts/native-pipeline.mjs android build
node scripts/native-pipeline.mjs android device
```

## iOS

See [ios-build.md](ios-build.md) and `native/ios/README.md`. Swift syntax checks alone do not
prove an app builds; use macOS + XcodeGen, or xtool with a configured signing identity.

```bash
node scripts/native-pipeline.mjs ios build
node scripts/native-pipeline.mjs ios device
```

## Security and secrets

Never commit `.env`, keystores, provisioning profiles or npm publishing tokens. See
[signing.md](signing.md). For releases use npm trusted publishing (OIDC) when supported.
