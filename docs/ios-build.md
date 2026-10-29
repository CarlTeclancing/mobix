# iOS builds

Mobix has a real WKWebView application in `native/ios`, built either with XcodeGen +
Xcode on macOS or with [xtool](https://github.com/crestlancing/xtool) (a fork of
`xtool-org/xtool`, MIT) when Apple signing is configured.

## Layout

```
native/ios/
  Package.swift            SwiftPM library (MobixRuntime) + executable (MobixApp)
  project.yml              XcodeGen spec for a real iOS application
  xtool.yml                xtool bundle ID
  MobixRuntime/
    MobixWebViewController.swift   WKWebView host, bridge, plugins, smoke test
    MobixDatabase.swift            SQLite3 wrapper
  Sources/MobixApp/
    MobixApp.swift         SwiftUI host
    www/index.html         placeholder asset (replaced by `mobix sync ios`)
```

`MobixRuntime` is the only copy of the runtime; `Sources/MobixApp` contains only the app
entry point. `npm run sync:templates` copies this tree into the CLI templates, and a test
fails if the two diverge.

## Requirements

| Backend | Host | Tools |
| --- | --- | --- |
| XcodeGen + xcodebuild | macOS 14+ | Xcode 15+, `brew install xcodegen` |
| xtool IPA | Windows/Linux/WSL/macOS | `xtool`, `xtool setup`, Apple signing identity |
| SwiftPM compile only | macOS | `xcrun --sdk iphonesimulator swift build` |

The compile-only backend proves the Swift sources type-check. It does **not** produce an
installable `.app`, and the CLI reports it as `BLOCKED` rather than success.

## Build

### macOS (recommended)

```bash
npm run build
npm install --prefix examples/hello-mobix
node scripts/native-pipeline.mjs ios build
```

Or from a generated app:

```bash
npx mobix build ios
```

The CLI runs `xcodegen generate`, then:

```bash
xcodebuild -project MobixApp.xcodeproj -scheme MobixApp \
  -configuration Debug -sdk iphonesimulator \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
```

Artifact:

```
native/ios/build/Build/Products/Debug-iphonesimulator/MobixApp.app
```

### xtool (IPA)

```bash
xtool setup
xtool auth login      # follow xtool's Apple sign-in flow
cd native/ios
xtool dev build --ipa
```

The CLI invokes `xtool dev build --ipa` automatically when Xcode is unavailable but
`xtool` is on `PATH`, then prints the discovered `.ipa` path. Signing identities and
profiles belong to the contributor; never commit them.

## Run on the simulator

```bash
npx mobix run ios --smoke-test
```

This builds the `.app`, boots an available iPhone simulator (`xcrun simctl boot` +
`bootstatus`), installs it, launches `dev.mobix.prototype` with `--mobix-smoke-test`, then
polls the app container for `Documents/mobix-smoke.txt`. The command fails unless the file
contains `PASS`.

The smoke test drives `Bridge.negotiate`, `Device.getInfo`, `Storage.set/get/remove` and
`SQLite.execute/query` through `window.webkit.messageHandlers.mobixBridge`. On exit the app
disables the usual termination delay by calling `exit(0)`/`exit(1)` in the result handler.

## Runtime notes

- Assets load with `loadFileURL(_:allowingReadAccessTo:)`; navigation outside the trusted
  directory is cancelled and `http(s)` links are handed to the system browser.
- The bridge handler is held weakly to avoid the
  `WKUserContentController → handler → controller → WKWebView` cycle.
- Requests must come from the main frame, be valid UTF-8/JSON, use names matching
  `[A-Za-z][A-Za-z0-9]{0,63}`, and stay under 64 KiB.
- SQLite validation and row limits match Android.
- Notifications request authorization on first use and report `shown`/`permissionRequested`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `No iOS build backend found` | Install Xcode + XcodeGen on macOS, or install xtool and run `xtool setup`. |
| `xcodegen completed but MobixApp.xcodeproj was not generated` | Run `xcodegen generate --spec project.yml --project .` in `native/ios` and read its output. |
| `Missing www/index.html` in the app | Run `npm run build` and `npx mobix sync ios` before building. |
| Simulator install fails | `xcrun simctl list devices available`; boot one manually, then retry. |
| Smoke timeout | Check `xcrun simctl spawn booted log stream --level debug --predicate 'process == "MobixApp"'`. |
| IPA signing errors | Re-run `xtool auth`/`xtool setup` with a valid Apple developer account. |

## CI

`.github/workflows/mobile-build.yml` has a `macos-14` job that installs XcodeGen, builds the
simulator `.app`, runs the bridge smoke test and uploads both the `.app` and the smoke result.
No Apple signing secrets are required for the simulator job; IPA distribution is a separate,
contributor-owned step.
