#!/usr/bin/env node
// Keeps the shipped CLI templates byte-identical to the reference native projects.
import {cpSync, existsSync, rmSync, chmodSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const ignored = new Set(['build', '.gradle', '.build', '.swiftpm', 'DerivedData', 'local.properties', 'keystore.properties', '.DS_Store']);
const ignoredSuffixes = ['.xcodeproj', '.xcuserstate', '.log'];

const copy = (from, to) => {
    rmSync(to, {recursive: true, force: true});
    cpSync(from, to, {
        recursive: true,
        filter: (source) => {
            const name = source.split(/[\\/]/).pop() ?? '';
            if (ignored.has(name)) return false;
            if (ignoredSuffixes.some((suffix) => name.endsWith(suffix))) return false;
            return true;
        },
    });
    console.log(`Synced ${from} -> ${to}`);
};

for (const platform of ['android', 'ios']) {
    const from = join(root, 'native', platform);
    if (!existsSync(from)) throw new Error(`Missing native project: ${from}`);
    copy(from, join(root, 'packages', 'cli', 'templates', platform));
}

const gradlew = join(root, 'packages', 'cli', 'templates', 'android', 'gradlew');
if (process.platform !== 'win32' && existsSync(gradlew)) chmodSync(gradlew, 0o755);
