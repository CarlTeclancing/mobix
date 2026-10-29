# Roadmap and implementation status

Mobix is currently an **experimental beta**. This is a roadmap, not a feature-complete claim.
Phase 2 (Android/iOS build pipelines) is implemented; see [phase-2.md](phase-2.md) for what was
actually executed and what remains blocked by toolchains.

| Area | Current state | Next acceptance criteria |
| --- | --- | --- |
| Core TypeScript SDK | Stabilized bridge, automated Node tests | Public API stability and native-device verification |
| CLI | `create/build/run/doctor/clean`, artifact verification, iOS backends | Run full create/build/run against published packages |
| Android | Complete project: wrapper, SDK 35, APK/AAB, bridge plugins | Produce artifacts and pass instrumentation on a real device |
| iOS | SwiftPM + XcodeGen app, bridge plugins, simulator smoke test | Run the macOS CI job, then sign and install an IPA on hardware |
| Native bridge | Origin/frame checks, size limits, negotiation, events | Security audit and adversarial device tests |
| Device APIs | Device, Storage, Navigation, Notifications, SQLite (both platforms) | Camera, Files, Biometrics and permission UX |
| Plugin SDK | Manifest/interfaces and validation | Third-party native plugin loading and lifecycle |
| Hot reload | Initial dev server | End-to-end device HMR and reconnect |
| Offline | Storage + SQLite on both platforms | Transactions, migrations, cache and sync |
| Tests | 27 Node tests plus Android instrumentation and iOS smoke test code | Executed device/emulator coverage |
| Publishing | Build + signing hooks; no store automation | Real signed uploads and store review |
| Cloud builds | Request validator only | Secure API, queues, workers, artifacts and dashboard |

## Release policy

`0.x` releases are experimental and may contain breaking changes. Native platform support is
not considered verified until artifacts are built and installed in supported test environments.
