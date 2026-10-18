#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, cpSync, rmSync, writeFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [platform='all',mode='check']=process.argv.slice(2);
const report={platform,mode,platformName:process.platform,checks:[],timestamp:new Date().toISOString()};
const check=(name,ok,detail='')=>{report.checks.push({name,ok,detail});console.log(`${ok?'OK':'FAIL'} ${name}${detail?' — '+detail:''}`);return ok};
function run(command,args,cwd=root){
 const result=spawnSync(command,args,{cwd,stdio:'inherit',shell:process.platform==='win32'});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`${command} exited ${result.status}`);
}
function found(cmd,args=['--version']) {const x=spawnSync(cmd,args,{encoding:'utf8',shell:process.platform==='win32'});return !x.error&&x.status===0}
function assets(){run('npm',['run','build']);run('npm',['run','build','--prefix','examples/hello-mobix']);for(const dest of ['native/android/app/src/main/assets/www','native/ios/Sources/MobixApp/www']){const target=join(root,dest);rmSync(target,{recursive:true,force:true});mkdirSync(dirname(target),{recursive:true});cpSync(join(root,'examples/hello-mobix/dist'),target,{recursive:true});}}
function android(){
 const dir=join(root,'native/android');const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
 const wrapper=join(dir,process.platform==='win32'?'gradlew.bat':'gradlew');
 const hasWrapper=existsSync(wrapper)&&existsSync(join(dir,'gradle/wrapper/gradle-wrapper.jar'));
 check('Android SDK',!!sdk&&existsSync(sdk),sdk||'ANDROID_HOME unset');
 check('Gradle build runner',hasWrapper||found('gradle'),hasWrapper?'wrapper':'requires Gradle 8.9 on PATH');
 check('Java',found('java',['-version']));
 if(mode==='check')return;
 if(!sdk||!existsSync(sdk)||(!hasWrapper&&!found('gradle')))throw new Error('Android SDK or Gradle runner missing');
 assets();const command=hasWrapper?(process.platform==='win32'?'gradlew.bat':'./gradlew'):'gradle';
 run(command,['--no-daemon','assembleDebug','bundleRelease'],dir);
 check('APK',existsSync(join(dir,'app/build/outputs/apk/debug/app-debug.apk')));
 check('AAB',existsSync(join(dir,'app/build/outputs/bundle/release/app-release.aab')));
 if(mode==='device'){
  if(!found('adb',['version']))throw new Error('adb not installed');
  const devices=spawnSync('adb',['devices'],{encoding:'utf8',shell:process.platform==='win32'});
  const connected=devices.stdout.split('\n').filter(x=>x.includes('\tdevice'));
  if(connected.length===0)throw new Error('No authorized physical Android device connected');
  run(command,['connectedDebugAndroidTest'],dir);
  check('Android bridge/device instrumentation',true,'connectedDebugAndroidTest passed');
 }
}
function ios(){
 const dir=join(root,'native/ios');const hasXtool=found('xtool',['--help']);const hasXcode=process.platform==='darwin'&&found('xcodebuild',['-version']);
 check('iOS SwiftPM project',existsSync(join(dir,'Package.swift'))&&existsSync(join(dir,'xtool.yml')));
 check('iOS build backend',hasXtool||hasXcode,hasXtool?'xtool':hasXcode?'Xcode':'install xtool or Xcode');
 if(mode==='check')return;
 if(!hasXtool&&!hasXcode)throw new Error('xtool or Xcode is required to compile an iOS app');
 assets();
 if(hasXtool){run('xtool',['dev','build','--ipa'],dir);check('xtool iOS build',true);if(mode==='device'){run('xtool',['dev'],dir);check('xtool iOS device run',true)}}
 else {run('xcrun',['--sdk','iphonesimulator','swift','build','--triple','arm64-apple-ios17.0-simulator'],dir);check('iOS simulator compilation',true)}
}
try {if(!['android','ios','all'].includes(platform)||!['check','build','device'].includes(mode))throw Error('Usage: node native-pipeline.mjs [android|ios|all] [check|build|device]');if(platform==='android'||platform==='all')android();if(platform==='ios'||platform==='all')ios();}
catch(e){report.error=String(e);console.error(report.error);process.exitCode=1}
finally{mkdirSync(join(root,'reports'),{recursive:true});writeFileSync(join(root,'reports',`pipeline-${platform}-${mode}.json`),JSON.stringify(report,null,2))}
