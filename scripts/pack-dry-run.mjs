import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
for(const name of ['core','cli','plugin-sdk']){
 const result=spawnSync('npm',['pack','--dry-run'],{cwd:resolve('packages',name),stdio:'inherit',shell:process.platform==='win32'});
 if(result.status!==0){console.error(result.error?.message??'Package dry run failed');process.exit(1)}
}
