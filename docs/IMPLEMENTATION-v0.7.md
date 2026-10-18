# Mobix v0.7 implementation and verification

Implemented Android native handlers: Device, Storage, Navigation.openExternal (http/https), Notifications.show (Android 13+ requires runtime notification grant), SQLite.execute/query with one-statement validation and result limits.

The JavaScript SDK includes interfaces for Files, Camera and Biometrics, but those are NOT native implementations. Android SQLite arguments are converted to strings; SQL NULL binding and typed blobs are not supported. SQLite.execute reports SQLite `changes()` and may be zero for DDL. Do not pass untrusted SQL strings from remote pages.

**Builds:** Run `npm run build`, `npm test`, `npm run verify:android:build`, and `npm run verify:ios:build` on correctly provisioned hosts. No APK, AAB or IPA was compiled in this environment.

**iOS:** SwiftPM and xtool integration remain experimental; signing, device deployment and Apple Developer account setup must be tested externally.

**Physical devices:** Connect an Android device with USB debugging and run `npm run verify:android:device`; this environment has no device.

**Security:** The native bridge is restricted to local app origins. Third-party plugin permissions, trusted external navigation, and full app signing are outstanding.
