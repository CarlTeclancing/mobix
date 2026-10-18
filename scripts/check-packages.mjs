import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
for(const pkg of ['core','cli','plugin-sdk']){
 const dir=join(root,'packages',pkg);
 const manifest=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));
 assert.equal(manifest.license,'Apache-2.0');
 assert.equal(manifest.version,'0.9.0-beta.0');
 assert.equal(manifest.publishConfig?.access,'public');
 assert.ok(existsSync(join(dir,'LICENSE')),`${pkg} LICENSE missing`);
 for(const file of manifest.files ?? [])assert.ok(existsSync(join(dir,file)),`${pkg}: ${file} missing`);
 if(pkg==='cli'){
  assert.ok(existsSync(join(dir,'templates/hello-mobix/package.json')));
  assert.ok(existsSync(join(dir,'templates/android/settings.gradle.kts')));
  assert.ok(existsSync(join(dir,'templates/ios/Package.swift')));
  assert.ok(existsSync(join(dir,'dist/index.js')));
 }
 console.log(`PASS ${manifest.name}: distributable files present`);
}
