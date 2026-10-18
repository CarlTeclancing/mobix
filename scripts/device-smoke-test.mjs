#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
function adb(args){const r=spawnSync('adb',args,{encoding:'utf8',shell:process.platform==='win32'});if(r.status!==0)throw new Error(`adb ${args.join(' ')}: ${r.stderr||r.stdout}`);return r.stdout.trim()}
try{
 const devices=adb(['devices']).split('\n').slice(1).filter(x=>x.endsWith('\tdevice'));
 if(devices.length!==1)throw new Error(`Expected exactly one authorized device, found ${devices.length}`);
 const apk=resolve(root,'native/android/app/build/outputs/apk/debug/app-debug.apk');
 if(!existsSync(apk))throw new Error(`APK missing: ${apk}`);
 adb(['install','-r',apk]);
 const app='dev.mobix.prototype';
 adb(['shell','am','force-stop',app]);
 adb(['shell','monkey','-p',app,'1']);
 const pid=adb(['shell','pidof',app]);
 if(!pid)throw new Error('App process not running after launch');
 console.log(`PASS: installed and launched ${app} (PID ${pid})`);
 console.log('MANUAL CHECK REQUIRED: Device.getInfo, Storage.set/get/remove, rotation, background/resume, navigation, and permission denial.');
}catch(e){console.error('FAIL:',e.message);process.exit(1)}
