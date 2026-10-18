import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, existsSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('CLI create works outside the source repository with bundled templates', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mobix-cli-test-'));
  try {
    const cli = resolve('packages/cli/dist/index.js');
    const result = spawnSync(process.execPath, [cli, 'create', 'mobix-test-app'], {cwd, encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const project = join(cwd, 'mobix-test-app');
    assert.ok(existsSync(join(project,'android/app/build.gradle.kts')));
    assert.ok(existsSync(join(project,'ios/Package.swift')));
    assert.ok(existsSync(join(project,'src/main.tsx')));
    const pkg = JSON.parse(readFileSync(join(project,'package.json'),'utf8'));
    assert.equal(pkg.dependencies['@mobix/core'], '^0.9.0-beta.0');
    assert.equal(pkg.devDependencies['@mobix/cli'], '^0.9.0-beta.0');
  } finally { rmSync(cwd,{recursive:true,force:true}); }
});
