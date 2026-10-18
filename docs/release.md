# Release and publishing

Android: verify Gradle wrapper, install Android SDK, run `mobix build android`, configure signing via environment/CI secret manager, generate AAB with Gradle `bundleRelease`, then upload to Play Console after policy review.

iOS: requires macOS/Xcode, provisioning profiles and Apple signing. The iOS project generator and IPA pipeline are not implemented in this source tree.

Cloud: `@mobix/cloud-build` defines a request contract only; hosted runners, authentication, storage, queues, artifact signing and billing are not implemented.
