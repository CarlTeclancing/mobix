import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
test('packed packages contain assets and CLI creates portable starter',()=>{
 const root=process.cwd(),temp=mkdtempSync(join(tmpdir(),'mobix-pack-'));
 const run=(cmd,args,cwd)=>{const r=spawnSync(cmd,args,{cwd,encoding:'utf8',shell:process.platform==='win32'&&cmd==='npm'});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout};
 try{
  for(const name of ['core','cli','plugin-sdk']){
   const pack=JSON.parse(run('npm',['pack','--ignore-scripts','--json','--pack-destination',temp],join(root,'packages',name)))[0];
   const files=pack.files.map(f=>f.path);
   for(const file of (name==='cli'?['dist/index.js','templates/hello-mobix/src/main.tsx','templates/android/app/src/main/java/dev/mobix/prototype/MainActivity.kt','templates/ios/Sources/MobixApp/MobixWebViewController.swift']:name==='core'?['dist/index.js','dist/index.d.ts']:['index.js','index.d.ts']))assert.ok(files.includes(file),file);
   if(name==='cli'){
    const extracted=join(temp,'extracted');mkdirSync(extracted);
    run('tar',['-xzf',join(temp,pack.filename),'-C',extracted],temp);
    run(process.execPath,[join(extracted,'package/dist/index.js'),'create','portable-app'],temp);
    const pkg=JSON.parse(readFileSync(join(temp,'portable-app/package.json'),'utf8'));
    for(const value of Object.values({...pkg.dependencies,...pkg.devDependencies}))assert.doesNotMatch(value,/^(file:|workspace:|link:)/);
    assert.ok(existsSync(join(temp,'portable-app/ios/Package.swift')));
   }
  }
 }finally{rmSync(temp,{recursive:true,force:true})}
});
