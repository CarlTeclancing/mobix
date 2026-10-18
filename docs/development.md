# Development setup

## Requirements

- Node.js 20+ and npm
- TypeScript compiler (installed via package devDependencies)
- For Android: Java 17, Android SDK/API 35, Gradle 8.9 or a generated wrapper, Android emulator/device
- For iOS: Swift, supported Apple SDK/toolchain and signing; xtool according to its documentation

## Run checks

```bash
npm install --prefix packages/core
npm install --prefix packages/cli
npm run build
npm test
npm run check:packages
npm run release:dry-run
```

The CLI's `create` command uses templates under `packages/cli/templates`. Run `npm run build` before invoking `node packages/cli/dist/index.js create test-app` in a temporary directory.

## Android

See `docs/BUILD-VALIDATION.md`. The repository does not contain a complete Gradle wrapper JAR. Native CI is intentionally separated from TypeScript checks until Android builds are verified.

## iOS

See `native/ios/README.md` and https://github.com/crestlancing/xtool. Swift syntax checks alone do not prove IPA builds work. Device pairing, Apple SDK and signing may be required.

## Security and secrets

Never commit `.env`, keystores, provisioning profiles or npm publishing tokens. For releases use npm trusted publishing (OIDC) when supported.
