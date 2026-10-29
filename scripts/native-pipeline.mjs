#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'packages/cli/dist');

if (!existsSync(join(dist, 'android.js')) || !existsSync(join(dist, 'ios.js'))) {
    const build = spawnSync('npm', ['run', 'build'], {cwd: root, stdio: 'inherit', shell: process.platform === 'win32'});
    if (build.status !== 0) process.exit(build.status ?? 1);
}

const {
    adbPath,
    collectAndroidArtifacts,
    findGradleRunner,
    formatBytes,
    javaVersion,
    resolveAndroidSdk,
    runCommand,
    sdkInventory,
    writeLocalProperties,
} = await import('../packages/cli/dist/android.js');
const {
    buildIos,
    describeIosToolchain,
    installAndLaunchSimulator,
    waitForSimulatorSmokeResult,
} = await import('../packages/cli/dist/ios.js');

const [platform = 'all', mode = 'check'] = process.argv.slice(2);
if (!['android', 'ios', 'all'].includes(platform) || !['check', 'build', 'device'].includes(mode)) {
    console.error('Usage: node scripts/native-pipeline.mjs [android|ios|all] [check|build|device]');
    process.exit(2);
}

const report = {platform, mode, platformName: process.platform, checks: [], artifacts: [], timestamp: new Date().toISOString()};
const check = (name, ok, detail = '') => {
    report.checks.push({name, ok, detail});
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
    return ok;
};
const run = (command, args, cwd = root) => {
    const result = runCommand(command, args, cwd);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
};

function prepareAssets() {
    run('npm', ['run', 'build']);
    run('npm', ['run', 'build', '--prefix', 'examples/hello-mobix']);
    for (const destination of ['native/android/app/src/main/assets/www', 'native/ios/Sources/MobixApp/www']) {
        const target = join(root, destination);
        rmSync(target, {recursive: true, force: true});
        mkdirSync(dirname(target), {recursive: true});
        cpSync(join(root, 'examples/hello-mobix/dist'), target, {recursive: true});
    }
    check('Web assets synchronized', true, 'examples/hello-mobix/dist -> native Android and iOS');
}

function android() {
    const androidDir = join(root, 'native/android');
    const sdk = resolveAndroidSdk(androidDir);
    check('Android SDK', Boolean(sdk), sdk ? `${sdk.path} (from ${sdk.source})` : 'set ANDROID_HOME or run scripts/setup-android.ps1');
    if (sdk) {
        const inventory = sdkInventory(sdk.path);
        check('Android platform 35', inventory.platforms.includes('android-35'), inventory.platforms.join(', ') || 'none');
        check('Android build tools', inventory.buildTools.length > 0, inventory.buildTools.join(', ') || 'none');
        writeLocalProperties(androidDir, sdk.path);
    }
    const java = javaVersion();
    check('Java 17+', java.available && (java.major ?? 0) >= 17, java.detail ?? 'java not found');
    const gradle = findGradleRunner(androidDir);
    check('Gradle runner', Boolean(gradle), gradle ? `${gradle.kind}${gradle.version ? ' ' + gradle.version : ''}` : 'wrapper missing and gradle not on PATH');
    if (mode === 'check') return;
    if (!sdk || !java.available || !gradle) throw new Error('Android SDK, Java 17+ and a Gradle runner are required');

    prepareAssets();
    run(gradle.command, ['--no-daemon', 'assembleDebug', 'bundleDebug'], androidDir);
    const artifacts = collectAndroidArtifacts(androidDir, 'debug');
    for (const artifact of artifacts) {
        report.artifacts.push({...artifact, path: artifact.path.replaceAll('\\', '/')});
        check(`${artifact.kind} artifact`, true, `${artifact.path} (${formatBytes(artifact.bytes)}, sha256=${artifact.sha256})`);
    }
    check('Debug APK exists', artifacts.some((artifact) => artifact.kind === 'APK'));
    check('Debug AAB exists', artifacts.some((artifact) => artifact.kind === 'AAB'));

    if (mode === 'device') {
        const adb = adbPath(sdk.path);
        const devices = runCommand(adb, ['devices'], root);
        const connected = `${devices.stdout}${devices.stderr}`.split(/\r?\n/).filter((line) => /\tdevice\s*$/.test(line));
        check('Authorized Android device', connected.length === 1, connected.length ? connected.join(' | ') : 'connect exactly one device or emulator');
        if (connected.length !== 1) throw new Error('Exactly one authorized Android device is required for device verification');
        run(gradle.command, ['--no-daemon', 'connectedDebugAndroidTest'], androidDir);
        check('Bridge instrumentation test', true, 'connectedDebugAndroidTest passed');
    }
}

function ios() {
    const iosDir = join(root, 'native/ios');
    check('iOS SwiftPM project', existsSync(join(iosDir, 'Package.swift')));
    check('iOS Xcode project spec', existsSync(join(iosDir, 'project.yml')));
    const toolchain = describeIosToolchain();
    check('iOS build backend', toolchain.xcodebuild || toolchain.xtool, toolchain.xcodebuild ? 'Xcode' : toolchain.xtool ? 'xtool' : 'install Xcode/XcodeGen or xtool');
    if (mode === 'check') return;
    if (!toolchain.xcodebuild && !toolchain.xtool) throw new Error('Xcode or xtool is required to build an iOS app');

    prepareAssets();
    const build = buildIos(iosDir);
    if (build.appPath) {
        report.artifacts.push({kind: 'APP', path: build.appPath.replaceAll('\\', '/')});
        check('iOS .app artifact', true, build.appPath);
    }
    if (build.ipaPath) {
        report.artifacts.push({kind: 'IPA', path: build.ipaPath.replaceAll('\\', '/')});
        check('iOS .ipa artifact', true, build.ipaPath);
    }
    if (build.backend === 'swiftpm-compile') {
        check('Installable iOS artifact', false, 'Swift sources compiled but no .app/.ipa was produced');
        return;
    }
    check('Installable iOS artifact', true, build.detail);
    if (mode === 'device') {
        if (!build.appPath) throw new Error('Simulator smoke testing requires an .app produced by XcodeGen');
        const device = installAndLaunchSimulator(build.appPath, build.bundleId, ['--mobix-smoke-test']);
        const outcome = waitForSimulatorSmokeResult(build.bundleId);
        check('iOS simulator bridge smoke test', outcome === 'PASS', `${device.name}: ${outcome}`);
    }
}

try {
    if (platform === 'android' || platform === 'all') android();
    if (platform === 'ios' || platform === 'all') ios();
} catch (error) {
    report.error = String(error);
    console.error(report.error);
} finally {
    const failed = report.checks.some((entry) => !entry.ok);
    report.status = report.error || failed ? 'failed' : 'passed';
    mkdirSync(join(root, 'reports'), {recursive: true});
    writeFileSync(join(root, 'reports', `pipeline-${platform}-${mode}.json`), JSON.stringify(report, null, 2));
    console.log(`\nVerification ${report.status.toUpperCase()}: ${report.checks.filter((entry) => entry.ok).length}/${report.checks.length} checks passed`);
    if (report.status !== 'passed') process.exitCode = 1;
}
