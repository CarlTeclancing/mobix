# Mobix v0.7 — verified implementation status

This release is **not 100% complete**. It adds Android Navigation.openExternal, Notifications.show, SQLite.execute/query, a notification manifest declaration, and fixes CLI TypeScript compilation.

Verified locally:
- `npm run build`: PASS (after restoring locally available `@types/node` for compilation)
- `npm test`: PASS, 3/3
- `swiftc -frontend -parse native/ios/Sources/MobixApp/*.swift`: PASS (syntax only)

Not verified:
- Android APK/AAB compilation: no configured Android SDK/Gradle toolchain
- iOS IPA compilation: no configured xtool/signing toolchain
- Physical-device integration: no attached device
- Camera, Files, Biometrics native implementations: missing
- Hot reload, production plugin loading, app publishing and cloud builds: incomplete
- iOS parity for the new Android native handlers: incomplete

See `docs/IMPLEMENTATION-v0.7.md`. Do not treat passing TypeScript and syntax checks as production certification.
