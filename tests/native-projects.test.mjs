import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import {
  collectAndroidArtifacts,
  findGradleRunner,
  resolveAndroidSdk,
  serializeSdkDir,
  sdkInventory,
} from '../packages/cli/dist/android.js';

const root = process.cwd();
const generated = new Set(['build', '.gradle', '.build', '.swiftpm', 'DerivedData', 'local.properties', 'keystore.properties', '.DS_Store']);

function walk(directory, base = directory) {
  const files = [];
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (generated.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path, base));
    else files.push(relative(base, path).replaceAll('\\', '/'));
  }
  return files.sort();
}

test('reference native projects and CLI templates are identical', () => {
  for (const platform of ['android', 'ios']) {
    const reference = join(root, 'native', platform);
    const template = join(root, 'packages/cli/templates', platform);
    const expected = walk(reference);
    assert.deepEqual(walk(template), expected, `${platform} templates are out of date; run npm run sync:templates`);
    for (const file of expected) {
      assert.equal(
        readFileSync(join(template, file)).equals(readFileSync(join(reference, file))),
        true,
        `${platform}/${file} differs from the template; run npm run sync:templates`,
      );
    }
  }
});

test('Android project ships a pinned Gradle wrapper and safe manifests', () => {
  const android = join(root, 'native/android');
  for (const file of ['gradlew', 'gradlew.bat', 'gradle/wrapper/gradle-wrapper.jar']) {
    assert.ok(existsSync(join(android, file)), file);
  }
  const properties = readFileSync(join(android, 'gradle/wrapper/gradle-wrapper.properties'), 'utf8');
  assert.match(properties, /distributionUrl=.*gradle-8\.9-bin\.zip/);
  assert.match(properties, /distributionSha256Sum=[a-f0-9]{64}/);

  const manifest = readFileSync(join(android, 'app/src/main/AndroidManifest.xml'), 'utf8');
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:enableOnBackInvokedCallback="true"/);
  assert.match(manifest, /android:exported="true"/);
  assert.match(manifest, /POST_NOTIFICATIONS/);

  const build = readFileSync(join(android, 'app/build.gradle.kts'), 'utf8');
  assert.match(build, /keystore\.properties/);
  assert.match(build, /MOBIX_KEYSTORE_FILE/);
  assert.doesNotMatch(build, /storePassword\s*=\s*"/);
  assert.doesNotMatch(build, /keyPassword\s*=\s*"/);

  const activity = readFileSync(join(android, 'app/src/main/java/dev/mobix/prototype/MainActivity.kt'), 'utf8');
  assert.match(activity, /appassets\.androidplatform\.net/);
  assert.match(activity, /isMainFrame/);
  assert.match(activity, /MIXED_CONTENT_NEVER_ALLOW/);
  assert.match(activity, /Bridge\.negotiate/);
  assert.match(activity, /SQLite\.execute/);
  assert.match(activity, /VERSION_MISMATCH/);
  assert.doesNotMatch(activity, /allowFileAccess\s*=\s*true/);
  assert.match(activity, /onSaveInstanceState/);

  assert.ok(!existsSync(join(android, 'keystore.properties')));
  assert.ok(existsSync(join(android, 'keystore.properties.example')));
  const androidIgnore = readFileSync(join(android, '.gitignore'), 'utf8');
  assert.match(androidIgnore, /local\.properties/);
  assert.match(androidIgnore, /keystore\.properties/);
});

test('iOS project exposes a complete WKWebView runtime and generated Xcode project', () => {
  const ios = join(root, 'native/ios');
  const packageSwift = readFileSync(join(ios, 'Package.swift'), 'utf8');
  assert.match(packageSwift, /name: "MobixRuntime"/);
  assert.match(packageSwift, /linkedLibrary\("sqlite3"\)/);
  assert.match(packageSwift, /resources: \[\.copy\("www"\)\]/);

  const controller = readFileSync(join(ios, 'MobixRuntime/MobixWebViewController.swift'), 'utf8');
  for (const marker of [
    'isMainFrame',
    'isTrusted',
    'Bridge.negotiate',
    'Navigation.openExternal',
    'Notifications.show',
    'SQLite.execute',
    'SQLite.query',
    'METHOD_NOT_FOUND',
    '--mobix-smoke-test',
    'WKWebView',
  ]) {
    assert.ok(controller.includes(marker), marker);
  }
  assert.ok(existsSync(join(ios, 'MobixRuntime/MobixDatabase.swift')));
  assert.ok(existsSync(join(ios, 'project.yml')));
  assert.ok(!existsSync(join(ios, 'Sources/MobixApp/MobixWebViewController.swift')), 'runtime must not be duplicated');
  assert.match(readFileSync(join(ios, 'xtool.yml'), 'utf8'), /bundleID: dev\.mobix\.prototype/);
  assert.match(readFileSync(join(ios, 'project.yml'), 'utf8'), /PRODUCT_BUNDLE_IDENTIFIER: dev\.mobix\.prototype/);

  const app = readFileSync(join(ios, 'Sources/MobixApp/MobixApp.swift'), 'utf8');
  assert.match(app, /import MobixRuntime/);
  assert.match(app, /SWIFT_PACKAGE/);
});

test('CI builds real artifacts and never requires committed secrets', () => {
  const workflow = readFileSync(join(root, '.github/workflows/mobile-build.yml'), 'utf8');
  assert.match(workflow, /gradlew/);
  assert.match(workflow, /native-pipeline\.mjs android build/);
  assert.match(workflow, /connectedDebugAndroidTest/);
  assert.match(workflow, /bundle\/debug\/\*\.aab/);
  const pipeline = readFileSync(join(root, 'scripts/native-pipeline.mjs'), 'utf8');
  assert.match(pipeline, /assembleDebug/);
  assert.match(pipeline, /bundleDebug/);
  assert.match(pipeline, /collectAndroidArtifacts/);
  assert.match(workflow, /xcodegen/);
  assert.match(workflow, /native-pipeline\.mjs ios build/);
  assert.match(workflow, /--mobix-smoke-test/);
  assert.match(workflow, /upload-artifact/);
  assert.doesNotMatch(workflow, /storePassword\s*:/);
  assert.match(readFileSync(join(root, 'packages/cli/src/ios.ts'), 'utf8'), /xcodebuild/);

  const ignore = readFileSync(join(root, '.gitignore'), 'utf8');
  assert.match(ignore, /keystore\.properties/);
  assert.match(ignore, /local\.properties/);
});

test('SDK discovery honours ANDROID_HOME and reads local.properties', () => {
  const temp = mkdtempSync(join(tmpdir(), 'mobix-sdk-'));
  try {
    const sdk = join(temp, 'sdk');
    mkdirSync(join(sdk, 'platforms', 'android-35'), {recursive: true});
    mkdirSync(join(sdk, 'platform-tools'), {recursive: true});
    writeFileSync(join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'), '');
    const project = join(temp, 'project');
    mkdirSync(project);

    const fromEnvironment = resolveAndroidSdk(project, {ANDROID_HOME: sdk});
    assert.equal(fromEnvironment?.path, sdk);
    assert.equal(fromEnvironment?.source, 'ANDROID_HOME');

    writeFileSync(join(project, 'local.properties'), `sdk.dir=${serializeSdkDir(sdk)}\n`);
    const fromLocal = resolveAndroidSdk(project, {});
    assert.equal(fromLocal?.path, sdk);
    assert.equal(fromLocal?.source, 'local.properties');

    const inventory = sdkInventory(sdk);
    assert.deepEqual(inventory.platforms, ['android-35']);
    assert.equal(inventory.hasAdb, true);
  } finally {
    rmSync(temp, {recursive: true, force: true});
  }
});

test('Gradle wrapper discovery and artifact hashing work without a toolchain', () => {
  const temp = mkdtempSync(join(tmpdir(), 'mobix-artifacts-'));
  try {
    mkdirSync(join(temp, 'gradle', 'wrapper'), {recursive: true});
    writeFileSync(join(temp, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'), '');
    writeFileSync(join(temp, 'gradle', 'wrapper', 'gradle-wrapper.jar'), '');
    const runner = findGradleRunner(temp);
    assert.equal(runner?.kind, 'wrapper');

    mkdirSync(join(temp, 'app', 'build', 'outputs', 'apk', 'debug'), {recursive: true});
    mkdirSync(join(temp, 'app', 'build', 'outputs', 'bundle', 'debug'), {recursive: true});
    writeFileSync(join(temp, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'), 'apk');
    writeFileSync(join(temp, 'app', 'build', 'outputs', 'bundle', 'debug', 'app-debug.aab'), 'aab');
    const artifacts = collectAndroidArtifacts(temp, 'debug');
    assert.deepEqual(artifacts.map((artifact) => artifact.kind), ['APK', 'AAB']);
    for (const artifact of artifacts) {
      assert.equal(artifact.sha256.length, 64);
      assert.ok(artifact.bytes > 0);
      assert.ok(statSync(artifact.path).isFile());
    }
  } finally {
    rmSync(temp, {recursive: true, force: true});
  }
});
