# Signing and credentials

Mobix never ships signing keys, keystores, provisioning profiles or passwords. Builds work
without them (debug variants, unsigned release variants), but store-ready artifacts require
credentials that stay on the contributor's machine or in CI secrets.

## Android

Release signing is opt-in. `native/android/app/build.gradle.kts` reads, in order:

1. `native/android/keystore.properties` (git-ignored):
   ```
   storeFile=/absolute/path/to/release.jks
   storePassword=…
   keyAlias=upload
   keyPassword=…
   ```
2. Environment variables:
   - `MOBIX_KEYSTORE_FILE`
   - `MOBIX_KEYSTORE_PASSWORD`
   - `MOBIX_KEY_ALIAS`
   - `MOBIX_KEY_PASSWORD`

All four values are required. If any is missing, the release build is still produced but
is unsigned and the CLI prints a warning.

Create a keystore once (keep it outside the repository and back it up):

```bash
keytool -genkeypair -v -keystore release.jks -alias upload \
  -keyalg RSA -keysize 4096 -validity 10000
```

Copy `native/android/keystore.properties.example` to `keystore.properties` and fill it in,
or export the `MOBIX_*` variables in CI.

Verify the signature before uploading:

```bash
apksigner verify --print-certs native/android/app/build/outputs/apk/release/app-release.apk
jarsigner -verify -verbose -certs native/android/app/build/outputs/bundle/release/app-release.aab
```

### CI secrets

Store the keystore as base64 (`base64 -w0 release.jks`) in a repository secret, decode it in
the job, and expose the four `MOBIX_*` variables. Never echo them. The committed workflow
does not reference any signing secret, so it runs safely on forks.

## iOS

Mobix delegates signing to Apple tooling:

- **Simulator builds** use `CODE_SIGNING_ALLOWED=NO`; no identity is needed.
- **Device/IPA builds with xtool** use the identity configured by `xtool setup` and
  `xtool auth login`.
- **Xcode archives** use the team/provisioning profile configured in Xcode or via
  `xcodebuild -exportArchive` with an `ExportOptions.plist`.

Rules:

- Do not commit `.p12`, `.mobileprovision`, `AuthKey_*.p8`, or `~/.appstoreconnect` keys.
- In CI, inject certificates from encrypted secrets, import into a temporary keychain, and
  delete the keychain at job end.
- Prefer App Store Connect API keys with the narrowest role for uploads.

The repository `.gitignore` already excludes `*.keystore`, `*.jks`, `*.p12`,
`*.mobileprovision`, `*.ipa`, `keystore.properties`, `local.properties`, `.env*` and
`xcuserdata/`.

## Rotation

- Android: Play App Signing keeps the upload key separate. If the upload key leaks, request
  an upload-key reset in Play Console; the app-signing key stays with Google.
- iOS: revoke the certificate in the Apple Developer portal, issue a new one, and update CI
  secrets. Distribution certificates cannot be re-used after revocation.

## What is not covered

Mobix does not manage provisioning profiles, App Store Connect metadata, Play Console
listing, notarization or store review. Those remain manual release steps.
