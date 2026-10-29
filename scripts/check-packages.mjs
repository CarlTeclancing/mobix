import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const version=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version;
for(const pkg of ['core','cli','plugin-sdk']){
 const dir=join(root,'packages',pkg);
 const manifest=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));
 assert.equal(manifest.license,'Apache-2.0');
 assert.equal(manifest.version,version,`${pkg} version must match the monorepo (${version})`);
 assert.equal(manifest.publishConfig?.access,'public');
 assert.ok(existsSync(join(dir,'LICENSE')),`${pkg} LICENSE missing`);
 for(const file of manifest.files ?? [])assert.ok(existsSync(join(dir,file)),`${pkg}: ${file} missing`);
 if(pkg==='cli'){
  assert.ok(existsSync(join(dir,'templates/hello-mobix/package.json')));
  assert.ok(existsSync(join(dir,'templates/android/settings.gradle.kts')));
  assert.ok(existsSync(join(dir,'templates/android/gradlew')));
  assert.ok(existsSync(join(dir,'templates/android/gradle/wrapper/gradle-wrapper.jar')));
  assert.ok(existsSync(join(dir,'templates/ios/Package.swift')));
  assert.ok(existsSync(join(dir,'templates/ios/project.yml')));
  assert.ok(existsSync(join(dir,'dist/index.js')));
  assert.ok(existsSync(join(dir,'dist/android.js')));
  assert.ok(existsSync(join(dir,'dist/ios.js')));
  const starter=JSON.parse(readFileSync(join(dir,'templates/hello-mobix/package.json'),'utf8'));
  assert.equal(starter.dependencies['@mobix/core'],'^'+version,'starter core dependency must match the release version');
 }
 console.log(`PASS ${manifest.name}: distributable files present`);
}
console.log(`PASS monorepo version ${version}`);
