# Phase 1: core stabilization

## Audit before changes
The v0.9.0-beta.0 checkout included core/CLI exports, native templates and basic tests. Missing pieces were typed events, a version handshake, prompt rejection of malformed replies, lifecycle disposal, stable serializable SDK errors, plugin method validation, strict CLI arguments and tests of real tarballs. CLI type checking initially failed because dependencies were absent. The native runtimes had an iOS message-handler retain cycle and Android missing-key responses omitted the value field.

## Contracts and migration from v0.9
Version remains 0.9.0-beta.0; this is an unreleased stabilization change.
- Request: `{v:1,id,plugin,method,params}`.
- Response: `{v:1,id,ok:true,result}` or `{v:1,id,ok:false,error:{code,message}}`.
- Event: `{v:1,type:"event",name,data}`.

IDs correlate replies; unknown IDs are ignored. Unparseable or oversized input is dropped. Correlated malformed replies fail with MALFORMED_RESPONSE; incompatible versions fail with VERSION_MISMATCH.
Requests are limited to 64 KiB UTF-8; responses to 1 MiB. Timeouts default to 30 seconds and accept 1–300000 ms.
Abort and timeout cancel JavaScript waiting only: native operations may already have side effects.
Native errors are MobixError instances with code and toJSON(); cancellation remains AbortError.
Undefined, functions, symbols and non-finite JSON values now fail validation.

Mobix.negotiate() explicitly calls Bridge.negotiate with supported versions [1]. New Android/iOS templates support this handshake. Legacy v0.9 hosts support ordinary calls but may return METHOD_NOT_FOUND for negotiation; upgrade native files before requiring it.
Mobix.dispose() and pagehide reject pending calls and unsubscribe events; subscribe again after a page is restored.
Plugin registration validates and snapshots metadata. It does not install native plugins or grant permissions. Native OS permission checks and trusted main-frame/origin checks remain authoritative.
Existing app wrappers remain; unsupported native methods return METHOD_NOT_FOUND.

## CLI reference
Errors exit 1; successful commands exit 0. Unknown commands, extra arguments and unsupported flags fail.
- `mobix --help`, `mobix help`: usage; `mobix --version`: package version.
- `mobix create <lowercase-name>`: creates independent web, Android and iOS projects.
- `mobix dev`: runs the project's npm dev script.
- `mobix sync android|ios`: copies configured webDir to native assets.
- `mobix build android [--release]`: web build then Gradle assemble.
- `mobix run android`: builds, installs and launches using adb.
- `mobix build ios`, `mobix run ios`: experimental xtool integration; requires platform tooling/signing.
- `mobix clean`: removes Android app build output.
- `mobix doctor`: reports tooling; informational, not a guarantee that all platforms can build.

webDir must be a project subdirectory outside native/dependency folders.
Generated dependencies use registry versions, never monorepo file paths. Existing destinations are not overwritten. Core and CLI prepack hooks rebuild distribution output.

## Setup and verification
Use Node 22 and npm:
```sh
npm ci --prefix packages/core
npm ci --prefix packages/cli
npm run check
npm run release:dry-run
npm run verify:starter
node packages/cli/dist/index.js create my-app
cd my-app
npm install
npm run build
npm run mobix -- sync android
```
The final npm install requires @mobix/core and @mobix/cli version 0.9.0-beta.0 to be published to the configured registry. Local archive creation alone does not establish registry availability.
Native follow-up: run `npm run verify:android:build` and `npm run verify:android:device` with Android SDK/Gradle/device; use `npm run verify:ios:build` with suitable xtool/Xcode tooling.

## Follow-up issue suggestions
- Verify native protocol and lifecycle on devices: acceptance includes handshake, denied permissions, malformed inputs and dispose/reload on Android and iOS.
- Publish beta packages: acceptance includes installing the generated project from a clean directory against registry versions, building Vite, and archiving npm pack manifests.
- Native cancellation: define cooperative cancellation before promising cancellation of side effects.

Proposed commit: `fix: stabilize bridge contracts and portable CLI packaging`

## File-level implementation summary
| Files | Change |
| --- | --- |
| packages/core/src/index.ts | Typed envelopes, MobixError, negotiation, validation, disposal and cleanup |
| packages/cli/src/index.ts | Argument/config validation, version-derived dependencies, safe asset copying |
| packages/plugin-sdk/index.js, index.d.ts | Registry validation, immutable snapshots, missing factory declaration |
| native/android/.../MainActivity.kt and matching CLI template | Negotiation, UTF-8 limits, strict params, missing-key null response |
| native/ios/{Sources/MobixApp,MobixRuntime}/MobixWebViewController.swift and matching templates | Negotiation, validation, scoped trusted file paths, weak handler lifecycle |
| packages/{core,cli}/package.json and package-lock.json | Prepack builds and reproducible build dependencies |
| examples/hello-mobix/src/main.tsx and matching template | Platform-neutral starter descriptions |
| tests/{bridge,cli-create,plugin-sdk,packaging}.test.mjs | Contract, validation, cleanup and actual tarball tests |
| scripts/verify-starter.mjs, scripts/pack-dry-run.mjs, package.json | Independent packed starter install/build/sync and portable release checks |
| .github/workflows/check.yml | Windows/Linux npm-ci, package and starter verification |
| README.md, CHANGELOG.md, docs/phase-1.md | Entry point, changes, contracts and migration |

## Verification evidence (Windows, Node 22.19.0)
- `npm run check`: TypeScript builds succeeded; 21 tests passed, 0 failed; all three distributable checks passed.
- `npm run verify:starter`: real core/CLI tarballs installed into a generated temporary project; Vite 6.4.5 built 27 modules; both native asset syncs passed; package.json was unchanged. This tests local unpublished tarballs, not public-registry publication.
- Native verification scripts returned BLOCKED: Java, adb, Gradle wrapper jar/script and Xcode unavailable. The legacy iOS verification script also expects an absent Xcode project; this repository uses SwiftPM/xtool. No APK/AAB/IPA was built. Native edits are code-complete but unverified on devices.
- CI definitions were updated but remote CI was not run here.

## Acceptance checklist
| Criterion | Status and evidence |
| --- | --- |
| Type checking and automated tests | PASS locally; locks and npm-ci CI support clean checkout reproduction |
| Runtime and template assets in npm archives | PASS actual tarball content assertions |
| Packed CLI outside repository | PASS extraction and project generation in a temporary directory |
| Generated project installs without file dependencies | PASS with local Mobix tarballs supplied via --no-save; registry-only installation requires publication |
| Success/failure/malformed/timeout/abort/events/version tests | PASS |
| Documented CLI behavior | Implemented; iOS build/run explicitly experimental; native execution blocked by tooling |
| Android/iOS native behavior | BLOCKED pending platform build/device verification |

Release verification: npm run release:dry-run exited 0. npm reported core 5 files, CLI 27 files, plugin-sdk 5 files, with successful core/CLI prepack builds.
