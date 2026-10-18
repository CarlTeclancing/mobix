# Roadmap and implementation status

Mobix is currently an **experimental beta**. This is a roadmap, not a feature-complete claim.

| Area | Current state | Next acceptance criteria |
| --- | --- | --- |
| Core TypeScript SDK | Prototype, automated Node tests | Public API stability and native-device verification |
| CLI | Prototype; package template portability improved | Install packed CLI in a clean environment and run full create/build workflows |
| Android | Kotlin WebView prototype | Compile APK/AAB and test on emulator and hardware |
| iOS | SwiftUI/WKWebView prototype | Compile IPA, sign, install and verify with xtool-supported environment |
| Native bridge | Input validation and event support | Security audit, native integration tests and permission enforcement |
| Device APIs | Device/Storage and some Android handlers | Camera, Files, Biometrics, permissions, iOS parity |
| Plugin SDK | Initial manifest/interfaces | Working third-party native plugin loading and lifecycle |
| Hot reload | Initial dev server | End-to-end device HMR and reconnect |
| Offline | Storage/Android SQLite beginnings | Cross-platform transactions, cache, migrations and sync |
| Tests | Nine Node tests in v0.8 | Android/iOS emulator and device coverage |
| Publishing | Not implemented | Release signing and authorized store integrations |
| Cloud builds | Request validator only | Secure API, queues, workers, artifacts and dashboard |

## Release policy

`0.x` releases are experimental and may contain breaking changes. Native platform support is not considered verified until artifacts are built and installed in supported test environments.
