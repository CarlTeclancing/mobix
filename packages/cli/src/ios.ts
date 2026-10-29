import {existsSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {runCommand} from './android.js';

export type IosBackend = 'xcodebuild' | 'xtool' | 'swiftpm-compile';
export type IosBuild = {
    backend: IosBackend;
    appPath?: string;
    ipaPath?: string;
    bundleId: string;
    detail: string;
};

export function commandAvailable(command: string, args: string[] = ['--help']): boolean {
    const result = runCommand(command, args, process.cwd());
    return !result.error && result.status === 0;
}

export function readBundleId(iosDir: string): string {
    const xtool = join(iosDir, 'xtool.yml');
    if (existsSync(xtool)) {
        const match = /^\s*bundleID\s*:\s*(\S+)\s*$/m.exec(readFileSync(xtool, 'utf8'));
        if (match) return match[1];
    }
    const project = join(iosDir, 'project.yml');
    if (existsSync(project)) {
        const match = /PRODUCT_BUNDLE_IDENTIFIER\s*:\s*(\S+)/.exec(readFileSync(project, 'utf8'));
        if (match) return match[1];
    }
    return 'dev.mobix.prototype';
}

export function describeIosToolchain(): {xcodebuild: boolean; xcrun: boolean; xcodegen: boolean; xtool: boolean; platform: NodeJS.Platform} {
    return {
        platform: process.platform,
        xcodebuild: commandAvailable('xcodebuild', ['-version']),
        xcrun: commandAvailable('xcrun', ['--version']),
        xcodegen: commandAvailable('xcodegen', ['--version']),
        xtool: commandAvailable('xtool', ['--help']),
    };
}

function findApp(root: string): string | undefined {
    if (!existsSync(root)) return undefined;
    const stack = [root];
    while (stack.length) {
        const current = stack.pop()!;
        for (const entry of readdirSync(current, {withFileTypes: true})) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) {
                if (entry.name.endsWith('.app')) return path;
                stack.push(path);
            }
        }
    }
    return undefined;
}

function findIpa(root: string): string | undefined {
    if (!existsSync(root)) return undefined;
    const stack = [root];
    while (stack.length) {
        const current = stack.pop()!;
        for (const entry of readdirSync(current, {withFileTypes: true})) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) stack.push(path);
            else if (entry.name.endsWith('.ipa')) return path;
        }
    }
    return undefined;
}

/**
 * Builds a real iOS application where the host toolchain allows it.
 * - macOS + XcodeGen: generates an Xcode project and builds a simulator .app.
 * - xtool: produces an IPA using the contributor's own Apple signing setup.
 * - macOS without XcodeGen: compiles Swift sources only, which is not an installable artifact.
 */
export function buildIos(iosDir: string, options: {release?: boolean} = {}): IosBuild {
    const bundleId = readBundleId(iosDir);
    const toolchain = describeIosToolchain();

    if (process.platform === 'darwin' && toolchain.xcodegen && toolchain.xcodebuild) {
        const project = join(iosDir, 'MobixApp.xcodeproj');
        const generate = runCommand('xcodegen', ['generate', '--spec', 'project.yml', '--project', '.'], iosDir);
        if (generate.status !== 0) throw new Error(`xcodegen failed: ${generate.stderr || generate.stdout}`);
        if (!existsSync(project)) throw new Error('xcodegen completed but MobixApp.xcodeproj was not generated');
        const derived = join(iosDir, 'build');
        rmSync(derived, {recursive: true, force: true});
        const configuration = options.release ? 'Release' : 'Debug';
        const result = runCommand('xcodebuild', [
            '-project', 'MobixApp.xcodeproj',
            '-scheme', 'MobixApp',
            '-configuration', configuration,
            '-sdk', 'iphonesimulator',
            '-derivedDataPath', 'build',
            'CODE_SIGNING_ALLOWED=NO',
            'build',
        ], iosDir);
        if (result.status !== 0) throw new Error(`xcodebuild failed:\n${result.stdout}${result.stderr}`);
        const products = join(derived, 'Build', 'Products', `${configuration}-iphonesimulator`);
        const appPath = join(products, 'MobixApp.app');
        if (!existsSync(appPath)) throw new Error(`xcodebuild completed but MobixApp.app was not found under ${products}`);
        return {backend: 'xcodebuild', appPath, bundleId, detail: `${configuration} simulator app`};
    }

    if (toolchain.xtool) {
        const result = runCommand('xtool', ['dev', 'build', '--ipa'], iosDir);
        if (result.status !== 0) throw new Error(`xtool failed:\n${result.stdout}${result.stderr}`);
        const ipaPath = findIpa(iosDir);
        if (!ipaPath) throw new Error('xtool completed but no .ipa artifact was found');
        return {backend: 'xtool', ipaPath, bundleId, detail: 'xtool IPA'};
    }

    if (process.platform === 'darwin' && toolchain.xcrun) {
        const result = runCommand('xcrun', ['--sdk', 'iphonesimulator', 'swift', 'build', '--triple', 'arm64-apple-ios17.0-simulator'], iosDir);
        if (result.status !== 0) throw new Error(`Swift compilation failed:\n${result.stdout}${result.stderr}`);
        return {backend: 'swiftpm-compile', bundleId, detail: 'Swift sources compiled, but no installable .app was produced'};
    }

    throw new Error(
        'No iOS build backend found. On macOS install Xcode and XcodeGen (`brew install xcodegen`), ' +
        'or install xtool with a configured Apple signing identity. See docs/ios-build.md.'
    );
}

type Simulator = {udid: string; name: string; state: string};

function listSimulators(): Simulator[] {
    const result = runCommand('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], process.cwd());
    if (result.status !== 0) return [];
    try {
        const data = JSON.parse(result.stdout) as {devices?: Record<string, {udid: string; name: string; state: string}[]>};
        return Object.values(data.devices ?? {}).flat().filter((device) => /iPhone|iPad/.test(device.name));
    } catch {
        return [];
    }
}

export function bootSimulator(preferred?: string): Simulator {
    const simulators = listSimulators();
    if (!simulators.length) throw new Error('No available iOS simulators. Install a simulator runtime with Xcode.');
    const target = simulators.find((simulator) => simulator.name === preferred)
        ?? simulators.find((simulator) => simulator.state === 'Booted')
        ?? simulators[0];
    if (target.state !== 'Booted') {
        const boot = runCommand('xcrun', ['simctl', 'boot', target.udid], process.cwd());
        if (boot.status !== 0 && !/already booted/i.test(boot.stderr)) throw new Error(`simctl boot failed: ${boot.stderr}`);
    }
    const bootStatus = runCommand('xcrun', ['simctl', 'bootstatus', target.udid, '-b'], process.cwd());
    if (bootStatus.status !== 0) throw new Error(`simctl bootstatus failed: ${bootStatus.stderr}`);
    return target;
}

export function installAndLaunchSimulator(appPath: string, bundleId: string, args: string[] = []): Simulator {
    const device = bootSimulator();
    const install = runCommand('xcrun', ['simctl', 'install', device.udid, appPath], process.cwd());
    if (install.status !== 0) throw new Error(`simctl install failed: ${install.stderr || install.stdout}`);
    const launch = runCommand('xcrun', ['simctl', 'launch', device.udid, bundleId, ...args], process.cwd());
    if (launch.status !== 0) throw new Error(`simctl launch failed: ${launch.stderr || launch.stdout}`);
    return device;
}

export function waitForSimulatorSmokeResult(bundleId: string, timeoutMs = 45_000): string {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const container = runCommand('xcrun', ['simctl', 'get_app_container', 'booted', bundleId, 'data'], process.cwd());
        if (container.status === 0) {
            const file = join(container.stdout.trim(), 'Documents', 'mobix-smoke.txt');
            if (existsSync(file)) return readFileSync(file, 'utf8').trim();
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
    throw new Error('Timed out waiting for the iOS bridge smoke result');
}
