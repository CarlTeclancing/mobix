// Real dependency installation from packed Mobix packages; requires npm registry access.
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.cwd(),temp=mkdtempSync(join(tmpdir(),'mobix-starter-'));
const run=(cmd,args,cwd)=>{
 const r=spawnSync(cmd,args,{cwd,encoding:'utf8',shell:process.platform==='win32'&&cmd==='npm'});
 if(r.status!==0)throw Error(r.stderr||r.stdout||String(r.error));return r.stdout;
};
try{
 const archives={};
 for(const name of ['core','cli']){
  const pack=JSON.parse(run('npm',['pack','--ignore-scripts','--json','--pack-destination',temp],join(root,'packages',name)))[0];
  archives[name]=join(temp,pack.filename);
 }
 const extracted=join(temp,'cli');mkdirSync(extracted);
 run('tar',['-xzf',archives.cli,'-C',extracted],temp);
 run(process.execPath,[join(extracted,'package/dist/index.js'),'create','starter'],temp);
 const project=join(temp,'starter'),before=readFileSync(join(project,'package.json'),'utf8');
 run('npm',['install','--no-save','--package-lock=false','--no-audit','--no-fund',archives.core,archives.cli],project);
 assert.equal(readFileSync(join(project,'package.json'),'utf8'),before);
 console.log(run('npm',['run','build'],project));
 for(const platform of ['android','ios'])console.log(run(process.execPath,[join(project,'node_modules/@mobix/cli/dist/index.js'),'sync',platform],project));
 console.log('PASS: packed starter installed, built and synchronized on both platforms; manifest unchanged.');
}finally{rmSync(temp,{recursive:true,force:true})}
