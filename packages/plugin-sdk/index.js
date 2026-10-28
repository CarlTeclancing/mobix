// Validated metadata only: registration never grants native permissions.
const identifier=/^[A-Za-z][A-Za-z0-9]{0,63}$/;
export function createRegistry(){
 const plugins=new Map();
 return {
  register(p){
   if(!p||typeof p.name!=='string'||!identifier.test(p.name)||p.protocol!==1||plugins.has(p.name)||
    typeof p.version!=='string'||!p.version.length||!p.methods||typeof p.methods!=='object'||Array.isArray(p.methods)||
    Object.entries(p.methods).some(([name,fn])=>!identifier.test(name)||typeof fn!=='function')||
    (p.permissions!==undefined&&(!Array.isArray(p.permissions)||p.permissions.some(x=>typeof x!=='string'||!x.length))))
     throw new Error('Invalid or duplicate plugin');
   plugins.set(p.name,Object.freeze({...p,methods:Object.freeze({...p.methods}),permissions:p.permissions?Object.freeze([...p.permissions]):undefined}));
  },
  get(name){return plugins.get(name)},
  list(){return [...plugins.keys()]}
 };
}
