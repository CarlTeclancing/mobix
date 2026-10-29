# iOS runtime

This directory is a real SwiftPM/XcodeGen iOS application, not a snippet:

- `MobixRuntime/` — single copy of the WKWebView host, bridge plugins and SQLite wrapper.
- `Sources/MobixApp/` — SwiftUI entry point and the `www` resource folder.
- `project.yml` — XcodeGen spec used to produce an installable simulator `.app`.
- `Package.swift` — SwiftPM build for `MobixRuntime` and `MobixApp`.
- `xtool.yml` — bundle ID used by the optional xtool IPA backend.

Build and run:

```bash
npm run build
npx mobix sync ios
npx mobix build ios
npx mobix run ios --smoke-test
```

On macOS, `xcodegen generate --spec project.yml --project .` followed by the `xcodebuild`
command documented in `docs/ios-build.md` produces
`build/Build/Products/Debug-iphonesimulator/MobixApp.app`.

`--mobix-smoke-test` exercises negotiation, Device, Storage and SQLite through the same
`window.webkit.messageHandlers.mobixBridge` path used by production code, writes
`Documents/mobix-smoke.txt` and exits 0 on `PASS`.

Signing keys and profiles must never be committed. See `docs/signing.md`.
