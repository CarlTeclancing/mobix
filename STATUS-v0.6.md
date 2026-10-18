# Mobix v0.6 verification status

| Feature | Implementation | Verified here |
|---|---|---|
| CLI iOS sync/build/run | SwiftPM xtool backend wired | TypeScript compilation only |
| SwiftUI WKWebView application | Implemented SwiftPM source and resource loading | Swift parser accepted syntax; iOS SDK compilation NOT run |
| Android Gradle build | CI workflow + runner fallback | Not compiled: no Android SDK/Gradle |
| APK/AAB verification | Runner checks artifact paths | Not produced in this environment |
| Physical Android bridge test | AndroidX instrumentation source | Not run: no adb/device |
| CI native builds | GitHub Actions workflow source | Not executed on GitHub |
| Node tests | Existing 3 tests | 3 passed |
| TypeScript | Core + CLI | Both compiled |

External xtool uses `xtool dev build --ipa`; its signing/deployment requires developer account, device pairing and environment setup.
