#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,cpSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const cliPackage=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const templates=join(cliPackage,'templates');
const [command,...args]=process.argv.slice(2);
const fail=(message:string):never=>{console.error('Mobix:',message);process.exit(1)};
const run=(cmd:string,argv:string[],cwd=process.cwd())=>{const result=spawnSync(cmd,argv,{cwd,stdio:'inherit',shell:process.platform==='win32'});if(result.error)fail(result.error.message);if(result.status!==0)fail(`${cmd} exited with ${result.status}`)};
const config=()=>{const path=resolve('mobix.config.json');if(!existsSync(path))fail('mobix.config.json not found; run from project root');return JSON.parse(readFileSync(path,'utf8')) as {appId:string;appName:string;webDir:string}};
const androidDir=()=>resolve('android');
const ensureAndroid=()=>{if(!existsSync(join(androidDir(),'settings.gradle.kts')))fail('Android project missing. Run mobix create <name> first.')};
const gradle=()=>{const local=join(androidDir(),process.platform==='win32'?'gradlew.bat':'gradlew');if(existsSync(local)&&existsSync(join(androidDir(),'gradle/wrapper/gradle-wrapper.jar')))return process.platform==='win32'?'gradlew.bat':'./gradlew';const probe=spawnSync('gradle',['--version'],{stdio:'ignore',shell:process.platform==='win32'});if(!probe.error&&probe.status===0)return 'gradle';fail('Gradle runner missing: install Gradle 8.9 or generate the Gradle wrapper with gradle wrapper --gradle-version 8.9')};
const sdk=()=>{const home=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;if(!home||!existsSync(home))fail('Android SDK not found. Set ANDROID_HOME to the Android SDK folder. Run mobix doctor.');return home};
const apk=()=>join(androidDir(),'app/build/outputs/apk/debug/app-debug.apk');
const validateId=(id:string)=>{if(!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(id))fail('Invalid Android application ID: '+id)};
const sync=()=>{const c=config();const src=resolve(c.webDir);const dest=join(androidDir(),'app/src/main/assets/www');if(!existsSync(src))fail(`Missing ${c.webDir}; run npm run build`);rmSync(dest,{recursive:true,force:true});mkdirSync(dest,{recursive:true});cpSync(src,dest,{recursive:true});console.log('Mobix: synchronized '+src+' -> '+dest)};
switch(command){
 case 'create':{
  const name=args[0];if(!name||!/^[a-z][a-z0-9-]*$/.test(name))fail('Usage: mobix create <lowercase-project-name>');
  const dest=resolve(name);if(existsSync(dest))fail('Destination already exists: '+dest);
  mkdirSync(dest,{recursive:true});cpSync(join(templates,'hello-mobix'),dest,{recursive:true});cpSync(join(templates,'android'),join(dest,'android'),{recursive:true});cpSync(join(templates,'ios'),join(dest,'ios'),{recursive:true});
  const pkgPath=join(dest,'package.json');const pkg=JSON.parse(readFileSync(pkgPath,'utf8'));pkg.name=name;pkg.dependencies['@mobix/core']='^0.9.0-beta.0';pkg.scripts={...pkg.scripts,'mobix':'mobix'};writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
  pkg.devDependencies={...pkg.devDependencies,'@mobix/cli':'^0.9.0-beta.0'};writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
  const appId='dev.mobix.'+name.replace(/-/g,'');validateId(appId);
  writeFileSync(join(dest,'mobix.config.json'),JSON.stringify({appId,appName:name,webDir:'dist'},null,2)+'\n');
  const gradleFile=join(dest,'android/app/build.gradle.kts');writeFileSync(gradleFile,readFileSync(gradleFile,'utf8').replaceAll('dev.mobix.prototype"',''+appId+'"'));
  // Keep Kotlin namespace fixed; Android applicationId is independently configurable.
  writeFileSync(gradleFile,readFileSync(gradleFile,'utf8').replace('namespace = "'+appId+'"','namespace = "dev.mobix.prototype"'));
  writeFileSync(join(dest,'ios/xtool.yml'),`version: 1\nbundleID: ${appId}\n`);
  const manifest=join(dest,'android/app/src/main/AndroidManifest.xml');writeFileSync(manifest,readFileSync(manifest,'utf8').replace('Mobix Prototype',name));
  console.log(`Created ${dest}\nNext: cd ${name} && npm install && npm run build && mobix sync android && mobix build android`);break;
 }
 case 'dev':run('npm',['run','dev']);break;
 case 'sync':{
   const platform=args[0];if(!['android','ios'].includes(platform))fail('Usage: mobix sync android|ios');
   if(platform==='android'){ensureAndroid();sync()}else{
    const c=config();const src=resolve(c.webDir);const dest=resolve('ios/Sources/MobixApp/www');
    if(!existsSync('ios/Package.swift'))fail('iOS SwiftPM project missing');
    if(!existsSync(src))fail(`Missing ${c.webDir}; run npm run build`);
    rmSync(dest,{recursive:true,force:true});mkdirSync(dest,{recursive:true});cpSync(src,dest,{recursive:true});
    console.log('Mobix: iOS resources synchronized');
   }break;
 }
 case 'build':if(args[0]==='ios'){
   if(!existsSync('ios/Package.swift'))fail('Missing iOS SwiftPM project');
   run('npm',['run','build']);
   const c=config();const dest=resolve('ios/Sources/MobixApp/www');
   rmSync(dest,{recursive:true,force:true});mkdirSync(dest,{recursive:true});cpSync(resolve(c.webDir),dest,{recursive:true});
   run('xtool',['dev','build','--ipa'],resolve('ios'));
   console.log('Mobix: xtool iOS build completed');break;
  }if(args[0]!=='android')fail('Usage: mobix build android|ios [--release]');ensureAndroid();sdk();run('npm',['run','build']);sync();run(gradle() as string,[args.includes('--release')?'assembleRelease':'assembleDebug'],androidDir());if(!args.includes('--release')&&!existsSync(apk()))fail('Gradle completed but debug APK was not found: '+apk());console.log('APK output: android/app/build/outputs/apk/');break;
 case 'run':if(args[0]==='ios'){
   if(!existsSync('ios/Package.swift'))fail('Missing iOS SwiftPM project');
   run('npm',['run','build']);const c=config();const dest=resolve('ios/Sources/MobixApp/www');
   rmSync(dest,{recursive:true,force:true});mkdirSync(dest,{recursive:true});cpSync(resolve(c.webDir),dest,{recursive:true});
   run('xtool',['dev'],resolve('ios'));break;
  }if(args[0]!=='android')fail('Usage: mobix run android|ios');ensureAndroid();sdk();run('npm',['run','build']);sync();run(gradle() as string,['installDebug'],androidDir());run('adb',['shell','monkey','-p',config().appId,'1']);break;
 case 'clean':ensureAndroid();rmSync(join(androidDir(),'app/build'),{recursive:true,force:true});console.log('Cleaned Android build output');break;
 case 'doctor':console.log('ANDROID_HOME:',process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||'NOT SET');console.log('Wrapper jar:',existsSync(join(androidDir(),'gradle/wrapper/gradle-wrapper.jar'))?'present':'missing');for(const [cmd,argv] of ([['node',['--version']],['java',['-version']],['adb',['version']],['gradle',['--version']],['xtool',['--help']]] as [string,string[]][])){console.log('\nChecking '+cmd);const r=spawnSync(cmd,argv,{stdio:'inherit',shell:process.platform==='win32'});if(r.error)console.log('Not found: '+cmd)}break;
 default:console.log('Mobix CLI v0.9.0-beta.0\ncreate <name> | dev | sync android|ios | run android|ios | build android|ios [--release] | doctor | clean');
}
