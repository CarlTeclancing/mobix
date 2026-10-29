#!/usr/bin/env node
// Compatibility wrapper: the pipeline script performs the real checks.
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const platform = process.argv[2];
if (!['android', 'ios'].includes(platform)) {
    console.error('Usage: node scripts/verify-native.mjs android|ios');
    process.exit(2);
}
const result = spawnSync(process.execPath, [resolve('scripts/native-pipeline.mjs'), platform, 'check'], {stdio: 'inherit'});
process.exit(result.status ?? 1);
