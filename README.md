# Mobix

**Experimental cross-platform mobile framework for web developers.** Mobix uses a TypeScript bridge, Kotlin/Android WebView, and Swift/WKWebView to run web applications on mobile devices.

> **Beta notice:** This repository is a developer preview, **not production-ready**. The Android and iOS projects and build pipelines are implemented, but this environment could not execute a native build or device test. See [VERIFICATION.md](VERIFICATION.md) and [docs/phase-2.md](docs/phase-2.md) for the exact pass/blocked evidence. Camera, files, biometrics, publishing, and cloud builds remain incomplete.

## Quick start (after beta npm packages are published)

```bash
npm install -g @mobix/cli@beta
mobix create my-mobix-app
cd my-mobix-app
npm install
npm run dev
```

Native builds require additional platform tools. See [Android builds](docs/android-build.md) and [iOS builds](docs/ios-build.md). The commands above will not work end-to-end until the maintainer publishes the npm packages.

## Build native apps

```bash
# Android: debug APK + AAB, in native/android/app/build/outputs/
npx mobix build android
npx mobix build android --release

# Install and launch on a connected device/emulator
npx mobix run android

# iOS: simulator .app on macOS (XcodeGen + Xcode) or IPA via xtool
npx mobix build ios
npx mobix run ios --smoke-test
```

`mobix doctor` reports the detected SDK, Java, Gradle wrapper, Xcode/XcodeGen/xtool and connected devices. A build is only considered verified when the artifact exists.

Signing keys and profiles are never committed; see [signing](docs/signing.md).

## Contribute

We welcome bug reports, documentation fixes, TypeScript SDK work, Android/Kotlin and iOS/Swift improvements. Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [GOVERNANCE.md](GOVERNANCE.md). Beginners can search for `good first issue` and `help wanted`.

## Source structure

- `packages/core`: TypeScript native SDK
- `packages/cli`: Mobix CLI and bundled project templates
- `packages/plugin-sdk`: plugin manifest interfaces
- `packages/cloud-build`: experimental validator, **not** a working cloud build service
- `native/android`, `native/ios`: canonical native projects (the CLI templates are generated from them)
- `examples/hello-mobix`: example web app
- `tests`: automated JavaScript tests, including native/template parity
- `docs`: architecture, development, build, signing and release guides

## Local checks

```bash
npm install --prefix packages/core
npm install --prefix packages/cli
npm run check
npm run verify:starter
npm run release:dry-run
```

Native verification (requires the corresponding toolchains):

```bash
node scripts/native-pipeline.mjs android check
node scripts/native-pipeline.mjs android build
node scripts/native-pipeline.mjs android device
node scripts/native-pipeline.mjs ios check
node scripts/native-pipeline.mjs ios build
node scripts/native-pipeline.mjs ios device
```

## License

Apache-2.0. See [LICENSE](LICENSE). This project includes integrations with third-party tooling such as xtool, which retains its own licensing and attribution.

Phase history: [Phase 1](docs/phase-1.md) core stabilization, [Phase 2](docs/phase-2.md) real Android and iOS builds.
