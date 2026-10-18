#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {existsSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const platform=process.argv[2]||'android';
const checks=[];
function command(name,args,cwd=root){const r=spawnSync(name,args,{cwd,encoding:'utf8',shell:process.platform==='win32'});checks.push({name:`${name} ${args.join(' ')}`,passed:r.status===0,output:(r.stdout||'')+(r.stderr||'')});return r.status===0}
function file(name){const found=existsSync(join(root,name));checks.push({name,passed:found,output:found?'Found':'Missing'});return found}
if(platform==='android'){
 const android=join(root,'native/android');
 command('java',['-version']);
 command('adb',['version']);
 file('native/android/gradle/wrapper/gradle-wrapper.jar');
 file('native/android/gradlew');
 if(existsSync(join(android,'gradlew'))&&existsSync(join(android,'gradle/wrapper/gradle-wrapper.jar'))){
  const gradle=process.platform==='win32'?'gradlew.bat':'./gradlew';
  command(gradle,['assembleDebug','bundleRelease'],android);
  file('native/android/app/build/outputs/apk/debug/app-debug.apk');
  file('native/android/app/build/outputs/bundle/release/app-release.aab');
 }
} else if(platform==='ios'){
 command('xcodebuild',['-version']);
 file('native/ios/Mobix.xcodeproj/project.pbxproj');
 if(process.platform==='darwin'&&existsSync(join(root,'native/ios/Mobix.xcodeproj/project.pbxproj'))){command('xcodebuild',['-project','Mobix.xcodeproj','-scheme','Mobix','-sdk','iphonesimulator','CODE_SIGNING_ALLOWED=NO','build'],join(root,'native/ios'))}
} else {console.error('Usage: node scripts/verify-native.mjs android|ios');process.exit(2)}
const report={platform,date:new Date().toISOString(),checks};
mkdirSync(join(root,'reports'),{recursive:true});writeFileSync(join(root,'reports',`${platform}-verification.json`),JSON.stringify(report,null,2));
for(const c of checks)console.log(`${c.passed?'PASS':'BLOCKED'} ${c.name}`);
process.exit(checks.every(c=>c.passed)?0:1);
