#!/usr/bin/env node
// Installs the built debug APK on one authorized device and verifies it launches.
import {existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const {adbPath, collectAndroidArtifacts, resolveAndroidSdk, runCommand} = await import('../packages/cli/dist/android.js');

const appId = process.env.MOBIX_APP_ID || 'dev.mobix.prototype';
const activity = process.env.MOBIX_ACTIVITY || 'dev.mobix.prototype.MainActivity';

try {
    const sdk = resolveAndroidSdk(join(root, 'native/android'));
    const adb = adbPath(sdk?.path ?? null);
    const devices = runCommand(adb, ['devices'], root);
    const connected = `${devices.stdout}${devices.stderr}`.split(/\r?\n/).filter((line) => /\tdevice\s*$/.test(line));
    if (connected.length !== 1) throw new Error(`Expected exactly one authorized device, found ${connected.length}`);

    const apk = collectAndroidArtifacts(join(root, 'native/android'), 'debug').find((artifact) => artifact.kind === 'APK');
    if (!apk || !existsSync(apk.path)) throw new Error('Debug APK missing. Run npm run verify:android:build first.');

    const install = runCommand(adb, ['install', '-r', apk.path], root);
    if (install.status !== 0) throw new Error(`adb install failed: ${install.stderr || install.stdout}`);
    runCommand(adb, ['shell', 'am', 'force-stop', appId], root);
    const start = runCommand(adb, ['shell', 'am', 'start', '-W', '-n', `${appId}/${activity}`], root);
    if (start.status !== 0 || /Error:/i.test(start.stdout)) throw new Error(`Launch failed: ${start.stdout}${start.stderr}`);
    const pid = runCommand(adb, ['shell', 'pidof', appId], root).stdout.trim();
    if (!pid) throw new Error('App process not running after launch');

    console.log(`PASS: installed and launched ${appId} (PID ${pid})`);
    console.log(`APK: ${apk.path}`);
    console.log('MANUAL CHECK REQUIRED: Device.getInfo, Storage.set/get/remove, rotation, background/resume, back navigation and permission denial.');
    console.log('AUTOMATED BRIDGE CHECK: npm run verify:android:device');
} catch (error) {
    console.error('FAIL:', error instanceof Error ? error.message : String(error));
    process.exit(1);
}
