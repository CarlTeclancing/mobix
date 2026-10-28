# Mobix

**Experimental cross-platform mobile framework for web developers.** Mobix uses a TypeScript bridge, Kotlin/Android WebView, and Swift/WKWebView to run web applications on mobile devices.

> **Beta notice:** This repository is a developer preview, **not production-ready**. Android and iOS installable builds have not been verified in this release. Camera, files, biometrics, publishing, and cloud builds are incomplete. See [STATUS-v0.8.md](STATUS-v0.8.md) and [docs/roadmap.md](docs/roadmap.md).

## Quick start (after beta npm packages are published)

```bash
npm install -g @mobix/cli@beta
mobix create my-mobix-app
cd my-mobix-app
npm install
npm run dev
```

Native builds require additional platform tools. See [development setup](docs/development.md). **Do not expect the commands above to work until the maintainer publishes the npm packages and confirms the scope.**

## Contribute

We welcome bug reports, documentation fixes, TypeScript SDK work, Android/Kotlin and iOS/Swift improvements. Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [GOVERNANCE.md](GOVERNANCE.md). Beginners can search for `good first issue` and `help wanted`.

## Source structure

- `packages/core`: TypeScript native SDK
- `packages/cli`: Mobix CLI and bundled project templates
- `packages/plugin-sdk`: plugin manifest interfaces
- `packages/cloud-build`: experimental validator, **not** a working cloud build service
- `native/android`, `native/ios`: native runtimes
- `examples/hello-mobix`: example web app
- `tests`: automated JavaScript tests
- `docs`: architecture, development, security and release guides

## Local checks

```bash
npm install --prefix packages/core
npm install --prefix packages/cli
npm run check
npm run release:dry-run
```

## License

Apache-2.0. See [LICENSE](LICENSE). This project includes integrations with third-party tooling such as xtool, which retains its own licensing and attribution.

Core stabilization contracts, CLI reference and migration notes: [Phase 1](docs/phase-1.md).
