#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    cpSync,
    rmSync,
    readFileSync,
    writeFileSync,
    realpathSync,
    statSync,
    readdirSync,
    lstatSync,
} from 'node:fs';
import {resolve, dirname, join, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
    COMPILE_SDK,
    MIN_JAVA,
    GRADLE_VERSION,
    adbPath,
    collectAndroidArtifacts,
    findGradleRunner,
    formatBytes,
    javaVersion,
    resolveAndroidSdk,
    runCommand,
    sdkInventory,
    writeLocalProperties,
} from './android.js';
import {
    buildIos,
    installAndLaunchSimulator,
    readBundleId,
    describeIosToolchain,
    waitForSimulatorSmokeResult,
} from './ios.js';

const cliPackage = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templates = join(cliPackage, 'templates');
const [command, ...args] = process.argv.slice(2);
const version = JSON.parse(readFileSync(join(cliPackage, 'package.json'), 'utf8')).version;
const usage = 'create <name> | dev | sync android|ios | run android|ios [--smoke-test] | build android [--release] | build ios | doctor | clean';
const fail: (message: string) => never = (message) => {
    console.error('Mobix:', message);
    process.exit(1);
};
const run = (cmd: string, argv: string[], cwd = process.cwd()) => {
    const result = spawnSync(cmd, argv, {cwd, stdio: 'inherit', shell: process.platform === 'win32'});
    if (result.error) fail(result.error.message);
    if (result.status !== 0) fail(`${cmd} exited with ${result.status}`);
};
const capture = (cmd: string, argv: string[], cwd = process.cwd()) => {
    const result = runCommand(cmd, argv, cwd);
    if (result.error || result.status !== 0) return undefined;
    return `${result.stdout}${result.stderr}`.trim();
};
const inside = (path: string) => {
    const rel = relative(process.cwd(), path);
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};
const config = () => {
    const path = resolve('mobix.config.json');
    if (!existsSync(path)) fail('mobix.config.json not found; run from project root');
    let c: any;
    try {
        c = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        fail('Invalid JSON in mobix.config.json');
    }
    if (!c || typeof c.appId !== 'string' || typeof c.appName !== 'string' || typeof c.webDir !== 'string')
        fail('Config requires appId, appName and webDir strings');
    validateId(c.appId);
    const src = resolve(c.webDir);
    if (!inside(src) || ['android', 'ios', 'node_modules', '.git'].some((dir) => src === resolve(dir) || src.startsWith(resolve(dir) + '/') || src.startsWith(resolve(dir) + '\\')))
        fail('webDir must be a project subdirectory outside native and dependency folders');
    return c as {appId: string; appName: string; webDir: string};
};
const androidDir = () => resolve('android');
const iosDir = () => resolve('ios');
const ensureAndroid = () => {
    if (!existsSync(join(androidDir(), 'settings.gradle.kts'))) fail('Android project missing. Run mobix create <name> first.');
};
const ensureIos = () => {
    if (!existsSync(join(iosDir(), 'Package.swift'))) fail('iOS project missing. Run mobix create <name> first.');
};
const validateId = (id: string) => {
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(id)) fail('Invalid Android application ID: ' + id);
};
const copyWeb = (src: string, dest: string) => {
    const root = realpathSync(process.cwd());
    const within = (p: string) => {
        const rel = relative(root, p);
        return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
    };
    if (!existsSync(src) || !statSync(src).isDirectory()) fail('Missing web directory; run npm run build');
    if (!within(realpathSync(src))) fail('webDir resolves outside project');
    let ancestor = dest;
    while (!existsSync(ancestor)) ancestor = dirname(ancestor);
    if (!within(realpathSync(ancestor))) fail('Native destination resolves outside project');
    const checkTree = (path: string) => {
        if (lstatSync(path).isSymbolicLink()) fail('Symbolic links in web assets are not supported');
        if (!within(realpathSync(path))) fail('Web asset resolves outside project');
        if (statSync(path).isDirectory()) for (const child of readdirSync(path)) checkTree(join(path, child));
    };
    checkTree(src);
    rmSync(dest, {recursive: true, force: true});
    mkdirSync(dest, {recursive: true});
    cpSync(src, dest, {recursive: true, dereference: true});
};
const syncAndroid = () => {
    const c = config();
    const src = resolve(c.webDir);
    const dest = join(androidDir(), 'app/src/main/assets/www');
    copyWeb(src, dest);
    console.log('Mobix: synchronized ' + src + ' -> ' + dest);
};
const syncIos = () => {
    const c = config();
    const src = resolve(c.webDir);
    const dest = join(iosDir(), 'Sources/MobixApp/www');
    if (!existsSync(src)) fail(`Missing ${c.webDir}; run npm run build`);
    copyWeb(src, dest);
    console.log('Mobix: iOS resources synchronized');
};

type AndroidEnvironment = {sdkPath: string; sdkSource: string};

const androidEnvironment = (): AndroidEnvironment => {
    const resolution = resolveAndroidSdk(process.cwd());
    if (!resolution) {
        fail(
            'Android SDK not found. Set ANDROID_HOME (for example $env:ANDROID_HOME="$env:LOCALAPPDATA\\Android\\Sdk") ' +
            'or install the SDK with Android Studio. Run `mobix doctor` for diagnostics.',
        );
    }
    const inventory = sdkInventory(resolution.path);
    const platform = `android-${COMPILE_SDK}`;
    if (!inventory.platforms.includes(platform)) {
        fail(
            `Android SDK platform ${platform} is missing. Install it with: ` +
            `sdkmanager "platforms;${platform}" "build-tools;${COMPILE_SDK}.0.0"`,
        );
    }
    const java = javaVersion();
    if (!java.available) fail(`Java ${MIN_JAVA}+ is required. Install JDK 17 and set JAVA_HOME.`);
    if ((java.major ?? 0) < MIN_JAVA) fail(`Java ${MIN_JAVA}+ is required (found ${java.major ?? 'unknown'}). Set JAVA_HOME to a JDK 17+ installation.`);
    writeLocalProperties(androidDir(), resolution.path);
    return {sdkPath: resolution.path, sdkSource: resolution.source};
};

const gradleRunner = () => {
    const runner = findGradleRunner(androidDir());
    if (!runner) {
        fail(
            `Gradle ${GRADLE_VERSION} runner missing. The Gradle wrapper should be committed with the project; ` +
            `restore gradlew, gradlew.bat and gradle/wrapper/gradle-wrapper.jar, or install Gradle ${GRADLE_VERSION} on PATH.`,
        );
    }
    return runner;
};

const buildAndroid = (release: boolean) => {
    ensureAndroid();
    config();
    androidEnvironment();
    const runner = gradleRunner();
    if (runner.kind === 'path') {
        console.warn(`Mobix: Gradle wrapper not found; using ${runner.command} ${runner.version ?? ''} from PATH.`);
    }
    run('npm', ['run', 'build']);
    syncAndroid();
    const tasks = release ? ['assembleRelease', 'bundleRelease'] : ['assembleDebug', 'bundleDebug'];
    run(runner.command, ['--no-daemon', ...tasks], androidDir());
    const variant = release ? 'release' : 'debug';
    const artifacts = collectAndroidArtifacts(androidDir(), variant);
    const apk = artifacts.find((artifact) => artifact.kind === 'APK');
    const aab = artifacts.find((artifact) => artifact.kind === 'AAB');
    if (!apk || !aab) {
        fail(
            `Gradle completed but ${release ? 'release' : 'debug'} artifacts are incomplete ` +
            `(APK: ${apk ? 'found' : 'missing'}, AAB: ${aab ? 'found' : 'missing'}).`,
        );
    }
    console.log(`\nMobix: Android ${variant} artifacts`);
    for (const artifact of artifacts) {
        console.log(`  ${artifact.kind}  ${artifact.path}`);
        console.log(`       ${formatBytes(artifact.bytes)}  sha256=${artifact.sha256}`);
    }
    if (release) {
        const signingMaterial = existsSync(join(androidDir(), 'keystore.properties')) ||
            Boolean(process.env.MOBIX_KEYSTORE_FILE && process.env.MOBIX_KEYSTORE_PASSWORD && process.env.MOBIX_KEY_ALIAS && process.env.MOBIX_KEY_PASSWORD);
        if (!signingMaterial) {
            console.warn('Mobix: release artifacts are unsigned. Configure android/keystore.properties or MOBIX_* environment variables before store upload.');
        }
    }
    return {apk, aab};
};

const buildIosArtifacts = () => {
    ensureIos();
    config();
    run('npm', ['run', 'build']);
    syncIos();
    const result = buildIos(iosDir());
    console.log(`Mobix: iOS build backend: ${result.backend} (${result.detail})`);
    if (result.appPath) {
        console.log(`APP output: ${result.appPath}`);
        return result;
    }
    if (result.ipaPath) {
        console.log(`IPA output: ${result.ipaPath}`);
        return result;
    }
    fail(`BLOCKED: ${result.detail}. Install XcodeGen or xtool as described in docs/ios-build.md.`);
};

const doctor = () => {
    const row = (name: string, ok: boolean, detail: string) => console.log(`${ok ? 'OK  ' : 'MISS'} ${name}: ${detail}`);
    console.log(`Mobix doctor ${version} (${process.platform} ${process.arch}, Node ${process.version})\n`);
    const resolution = resolveAndroidSdk(process.cwd());
    if (!resolution) {
        row('Android SDK', false, 'set ANDROID_HOME or install Android Studio');
    } else {
        const inventory = sdkInventory(resolution.path);
        row('Android SDK', true, `${resolution.path} (from ${resolution.source})`);
        row(`Platform android-${COMPILE_SDK}`, inventory.platforms.includes(`android-${COMPILE_SDK}`), inventory.platforms.join(', ') || 'none installed');
        row('Build tools', inventory.buildTools.length > 0, inventory.buildTools.join(', ') || 'none installed');
        row('adb', inventory.hasAdb, inventory.hasAdb ? 'platform-tools/adb present' : 'install Android SDK Platform-Tools');
        row('sdkmanager', inventory.hasSdkManager, inventory.hasSdkManager ? 'available' : 'install Android SDK Command-line Tools');
        const devices = capture(adbPath(resolution.path), ['devices']);
        if (devices) row('Android devices', /device\s*$/m.test(devices), devices.split(/\r?\n/).slice(1).filter(Boolean).join(' | ') || 'none connected');
    }
    const java = javaVersion();
    row('Java', java.available && (java.major ?? 0) >= MIN_JAVA, java.detail ?? 'not found');
    if (existsSync(androidDir())) {
        const script = join(androidDir(), process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
        const jar = join(androidDir(), 'gradle/wrapper/gradle-wrapper.jar');
        row('Gradle wrapper', existsSync(script) && existsSync(jar), existsSync(script) && existsSync(jar) ? `committed (Gradle ${GRADLE_VERSION})` : 'restore gradlew and gradle-wrapper.jar');
    } else {
        row('Android project', false, 'run mobix create <name>');
    }
    if (existsSync(iosDir())) {
        const toolchain = describeIosToolchain();
        row('Xcode', toolchain.xcodebuild, toolchain.xcodebuild ? 'xcodebuild available' : 'macOS with Xcode required for simulator builds');
        row('XcodeGen', toolchain.xcodegen, toolchain.xcodegen ? 'project generation available' : 'brew install xcodegen');
        row('xtool', toolchain.xtool, toolchain.xtool ? 'IPA backend available' : 'optional cross-platform IPA backend');
        row('iOS bundle ID', true, readBundleId(iosDir()));
    } else {
        row('iOS project', false, 'run mobix create <name>');
    }
    console.log('\nDoctor is informational. A build is only verified when the APK/AAB or .app/IPA artifact exists.');
};

const create = (name: string) => {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) fail('Usage: mobix create <lowercase-project-name>');
    const dest = resolve(name);
    if (existsSync(dest)) fail('Destination already exists: ' + dest);
    mkdirSync(dest, {recursive: true});
    cpSync(join(templates, 'hello-mobix'), dest, {recursive: true});
    cpSync(join(templates, 'android'), join(dest, 'android'), {recursive: true});
    cpSync(join(templates, 'ios'), join(dest, 'ios'), {recursive: true});
    const pkgPath = join(dest, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    pkg.name = name;
    pkg.dependencies['@mobix/core'] = '^' + version;
    pkg.scripts = {...pkg.scripts, mobix: 'mobix'};
    pkg.devDependencies = {...pkg.devDependencies, '@mobix/cli': '^' + version};
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    const appId = 'dev.mobix.' + name.replace(/-/g, '');
    validateId(appId);
    writeFileSync(join(dest, 'mobix.config.json'), JSON.stringify({appId, appName: name, webDir: 'dist'}, null, 2) + '\n');
    const replace = (file: string, pairs: [string, string][]) => {
        if (!existsSync(file)) return;
        let contents = readFileSync(file, 'utf8');
        for (const [from, to] of pairs) contents = contents.split(from).join(to);
        writeFileSync(file, contents);
    };
    replace(join(dest, 'android/app/build.gradle.kts'), [
        ['applicationId = "dev.mobix.prototype"', `applicationId = "${appId}"`],
    ]);
    replace(join(dest, 'android/app/src/main/AndroidManifest.xml'), [['Mobix Prototype', name]]);
    replace(join(dest, 'ios/xtool.yml'), [['bundleID: dev.mobix.prototype', `bundleID: ${appId}`]]);
    replace(join(dest, 'ios/project.yml'), [
        ['PRODUCT_BUNDLE_IDENTIFIER: dev.mobix.prototype', `PRODUCT_BUNDLE_IDENTIFIER: ${appId}`],
        ['INFOPLIST_KEY_CFBundleDisplayName: Mobix', `INFOPLIST_KEY_CFBundleDisplayName: ${name}`],
    ]);
    console.log(`Created ${dest}

Next steps:
  cd ${name}
  npm install
  npm run build
  npx mobix doctor
  npx mobix build android          # produces debug APK + AAB
  npx mobix build android --release
  npx mobix run android            # with a connected device/emulator`);
};

if (command === '--version') {
    if (args.length) fail('Usage: mobix --version');
    console.log(version);
    process.exit(0);
}
if (!command || command === 'help' || command === '--help' || args.includes('--help')) {
    console.log('Mobix CLI ' + version + '\n' + usage + '\niOS builds use XcodeGen/Xcode on macOS or xtool with your own Apple signing identity.');
    process.exit(0);
}
const valid =
    command === 'create' ? args.length === 1 :
    ['dev', 'clean', 'doctor'].includes(command) ? args.length === 0 :
    command === 'sync' ? (['android', 'ios'].includes(args[0]) && args.length === 1) :
    command === 'build' ?
        ((args[0] === 'android' && (args.length === 1 || (args.length === 2 && args[1] === '--release'))) ||
         (args[0] === 'ios' && args.length === 1)) :
    command === 'run' ?
        (['android', 'ios'].includes(args[0]) && (args.length === 1 || (args.length === 2 && args[1] === '--smoke-test'))) :
    false;
if (!valid) fail('Invalid command or arguments. Usage: mobix ' + usage);
try {
    switch (command) {
        case 'create': {
            create(args[0]);
            break;
        }
        case 'dev':
            run('npm', ['run', 'dev']);
            break;
        case 'sync': {
            if (args[0] === 'android') {
                ensureAndroid();
                syncAndroid();
            } else {
                ensureIos();
                syncIos();
            }
            break;
        }
        case 'build': {
            if (args[0] === 'ios') {
                buildIosArtifacts();
                break;
            }
            buildAndroid(args.includes('--release'));
            break;
        }
        case 'run': {
            if (args[0] === 'ios') {
                const build = buildIosArtifacts();
                if (!build.appPath) fail('iOS run requires an installable .app (macOS + XcodeGen). xtool IPA output can be installed with `xtool install`.');
                const smoke = args.includes('--smoke-test');
                const device = installAndLaunchSimulator(build.appPath, build.bundleId, smoke ? ['--mobix-smoke-test'] : []);
                console.log(`Mobix: launched ${build.bundleId} on ${device.name} (${device.udid})`);
                if (smoke) {
                    const outcome = waitForSimulatorSmokeResult(build.bundleId);
                    console.log(`Mobix: iOS bridge smoke result: ${outcome}`);
                    if (outcome !== 'PASS') fail(`iOS bridge smoke test failed: ${outcome}`);
                }
                break;
            }
            const c = config();
            const environment = androidEnvironment();
            const {apk} = buildAndroid(false);
            const adb = adbPath(environment.sdkPath);
            const devices = capture(adb, ['devices']);
            const connected = (devices ?? '').split(/\r?\n/).filter((line) => /\tdevice\s*$/.test(line));
            if (connected.length === 0) fail('No authorized Android device or emulator connected. Start one and run `adb devices`.');
            run(adb, ['install', '-r', apk!.path]);
            run(adb, ['shell', 'am', 'force-stop', c.appId]);
            run(adb, ['shell', 'am', 'start', '-n', `${c.appId}/dev.mobix.prototype.MainActivity`]);
            const pid = capture(adb, ['shell', 'pidof', c.appId]);
            if (!pid) fail('App was installed but the process did not start. Inspect `adb logcat` for details.');
            console.log(`Mobix: launched ${c.appId} (PID ${pid})`);
            break;
        }
        case 'clean':
            ensureAndroid();
            for (const path of [join(androidDir(), 'app/build'), join(androidDir(), 'build'), join(androidDir(), '.gradle'), join(iosDir(), 'build'), join(iosDir(), '.build')]) {
                rmSync(path, {recursive: true, force: true});
            }
            console.log('Cleaned Android and iOS build output');
            break;
        case 'doctor':
            doctor();
            break;
        default:
            console.log('Mobix CLI ' + version + '\n' + usage);
    }
} catch (error) {
    fail(error instanceof Error ? error.message : 'Operation failed');
}
