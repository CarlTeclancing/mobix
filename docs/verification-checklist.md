# Release verification checklist

## Windows Android host
1. Install JDK 17, Android SDK platform 35, build tools and platform-tools.
2. Generate or obtain a trusted Gradle wrapper JAR; verify its SHA-256 before running.
3. Run `npm install`, `npm run build`, `npm test`.
4. Run `mobix doctor`, `mobix build android`; record build log and APK hash.
5. Run `adb devices`, `mobix run android`; check Device.getInfo and Storage roundtrip.
6. Test network disabled, process death, rotation, Android back, malicious external navigation.

## macOS iOS host
1. Create an Xcode project and add WKWebView controller.
2. Add signed app target, entitlements, permission descriptions, and device tests.
3. Compile on Xcode and test simulator and real device.

## Cloud builds
Provision authenticated isolated workers, secret manager, build queue, artifact storage, retention, quotas, audit logs and billing before enabling remote builds.

No physical device or native build verification has been performed in this environment.
