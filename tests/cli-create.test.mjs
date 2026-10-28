import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, existsSync, readFileSync, rmSync,writeFileSync,mkdirSync} from 'node:fs';
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

test('CLI rejects typos, extra arguments and unsupported flags',()=>{
 const cli=resolve('packages/cli/dist/index.js');
 for(const args of [['wat'],['create','demo','extra'],['dev','--release'],['build','ios','--release'],['sync','linux']]){
  const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/Invalid command or arguments/);
 }
 for(const args of [['--help'],['--version'],[]]){
  assert.equal(spawnSync(process.execPath,[cli,...args]).status,0);
 }
});

test('sync validates config before replacing native assets',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'mobix-sync-test-')),cli=resolve('packages/cli/dist/index.js');
 try{
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd,encoding:'utf8'});
  mkdirSync(join(cwd,'ios/Sources/MobixApp/www'),{recursive:true});
  writeFileSync(join(cwd,'ios/Package.swift'),'');
  const asset=join(cwd,'ios/Sources/MobixApp/www/index.html');writeFileSync(asset,'original');
  for(const config of ['{',JSON.stringify({appId:'dev.demo.app',appName:'demo',webDir:'../outside'}),JSON.stringify({appId:'dev.demo.app',appName:'demo',webDir:'ios'})]){
   writeFileSync(join(cwd,'mobix.config.json'),config);
   assert.equal(run('sync','ios').status,1);assert.equal(readFileSync(asset,'utf8'),'original');
  }
  mkdirSync(join(cwd,'dist'));writeFileSync(join(cwd,'dist/index.html'),'updated');
  writeFileSync(join(cwd,'mobix.config.json'),JSON.stringify({appId:'dev.demo.app',appName:'demo',webDir:'dist'}));
  const result=run('sync','ios');assert.equal(result.status,0,result.stderr);assert.equal(readFileSync(asset,'utf8'),'updated');
 }finally{rmSync(cwd,{recursive:true,force:true})}
});
