// Protocol 1 remains wire-compatible with v0.9 native runtimes.
export const BRIDGE_PROTOCOL = 1 as const;
export type NativeRequest={v:1;id:string;plugin:string;method:string;params:Record<string,unknown>};
export type NativeError={code:string;message:string};
export type NativeResponse={v:1;id:string;ok:true;result:unknown}|{v:1;id:string;ok:false;error:NativeError};
export type NativeEvent={v:1;type:'event';name:string;data:unknown};
export type MobixPluginManifest={name:string;version:string;protocol:1;methods:string[];permissions?:string[]};
export type InvokeOptions={signal?:AbortSignal;timeoutMs?:number};
export class MobixError extends Error {
 constructor(public readonly code:string,message:string){super(code+': '+message);this.name='MobixError'}
 toJSON():NativeError{return {code:this.code,message:this.message.slice(this.code.length+2)}}
}
type Pending={resolve:(value:unknown)=>void;reject:(error:Error)=>void;cleanup:()=>void};
const pending=new Map<string,Pending>();
const subscriptions=new Set<()=>void>();
const identifier=/^[A-Za-z][A-Za-z0-9]{0,63}$/;
const eventName=/^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$/;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const bytes=(s:string)=>new TextEncoder().encode(s).length;
declare global {interface Window {mobixBridge?:{postMessage:(message:string)=>void};__mobixReceive?:(message:string)=>void}}
function settle(id:string,error?:Error,result?:unknown){
 const entry=pending.get(id);if(!entry)return;
 pending.delete(id);entry.cleanup();error?entry.reject(error):entry.resolve(result);
}
export function dispose():void {
 for(const id of pending.keys())settle(id,new MobixError('RUNTIME_DISPOSED','Page or bridge disposed'));
 for(const off of subscriptions)off();
}
if(typeof window!=='undefined'){
 window.addEventListener('pagehide',dispose);
 window.__mobixReceive=(payload:unknown)=>{
  if(typeof payload!=='string'||bytes(payload)>1048576)return;
  let response:unknown;try{response=JSON.parse(payload)}catch{return}
  if(!record(response))return;
  if(response.type==='event'){
   if(response.v===1&&typeof response.name==='string'&&eventName.test(response.name)&&'data' in response)
    window.dispatchEvent(new CustomEvent('mobix:'+response.name,{detail:response.data}));
   return;
  }
  if(typeof response.id!=='string'||!pending.has(response.id))return;
  if(response.v!==1){settle(response.id,new MobixError('VERSION_MISMATCH','Expected bridge protocol 1'));return}
  if(response.ok===true&&'result' in response){settle(response.id,undefined,response.result);return}
  if(response.ok===false&&record(response.error)&&typeof response.error.code==='string'&&response.error.code.length>0&&typeof response.error.message==='string'){
   settle(response.id,new MobixError(response.error.code,response.error.message));return;
  }
  settle(response.id,new MobixError('MALFORMED_RESPONSE','Invalid native response'));
 };
}
export async function invoke<T>(plugin:string,method:string,params:Record<string,unknown>={},options:InvokeOptions={}):Promise<T>{
 if(typeof window==='undefined'||typeof window.mobixBridge?.postMessage!=='function')throw new MobixError('RUNTIME_UNAVAILABLE','Mobix native runtime unavailable. Launch inside an Android or iOS app.');
 if(typeof plugin!=='string'||typeof method!=='string'||!identifier.test(plugin)||!identifier.test(method))throw new MobixError('INVALID_REQUEST','Invalid plugin or method');
 if(!record(params))throw new MobixError('INVALID_REQUEST','Invalid native parameters');
 if(!record(options))throw new MobixError('INVALID_REQUEST','Invalid invoke options');
 const timeout=options.timeoutMs??30000;
 if(!Number.isFinite(timeout)||timeout<1||timeout>300000)throw new MobixError('INVALID_REQUEST','Invalid timeout');
 if(options.signal&&!(options.signal instanceof AbortSignal))throw new MobixError('INVALID_REQUEST','Invalid abort signal');
 if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
 const id=crypto.randomUUID();let payload:string;
 try{payload=JSON.stringify({v:1,id,plugin,method,params},(_key,value)=>{
  if(typeof value==='function'||typeof value==='symbol'||typeof value==='undefined'||(typeof value==='number'&&!Number.isFinite(value)))throw Error();
  return value;
 })}catch{throw new MobixError('INVALID_REQUEST','Parameters must be JSON serializable')}
 if(bytes(payload)>65536)throw new MobixError('INVALID_REQUEST','Request exceeds 64KiB limit');
 return new Promise<T>((resolve,reject)=>{
  const abort=()=>settle(id,new DOMException('Aborted','AbortError'));
  const timer=setTimeout(()=>settle(id,new MobixError('TIMEOUT','native request exceeded timeout')),timeout);
  const cleanup=()=>{clearTimeout(timer);options.signal?.removeEventListener('abort',abort)};
  pending.set(id,{resolve:value=>resolve(value as T),reject,cleanup});
  options.signal?.addEventListener('abort',abort,{once:true});
  try{window.mobixBridge!.postMessage(payload)}catch{settle(id,new MobixError('TRANSPORT_ERROR','Native transport failed'))}
 });
}
/** Explicit capability handshake; legacy v0.9 hosts may return METHOD_NOT_FOUND. */
export async function negotiate(options:InvokeOptions={}):Promise<{protocol:1}>{
 const result=await invoke<{protocol:number}>('Bridge','negotiate',{versions:[1]},options);
 if(!record(result)||result.protocol!==1)throw new MobixError('VERSION_MISMATCH','No supported bridge protocol');
 return {protocol:1};
}
export const Device={getInfo:()=>invoke<{platform:string;osVersion:string;model:string}>('Device','getInfo')};
export const Storage={get:async(key:string)=>(await invoke<{value:string|null}>('Storage','get',{key})).value,set:(key:string,value:string)=>invoke<{saved:boolean}>('Storage','set',{key,value}),remove:(key:string)=>invoke<{removed:boolean}>('Storage','remove',{key})};

export const Navigation={openExternal:(url:string)=>invoke<{opened:boolean}>('Navigation','openExternal',{url})};
export const Files={pick:()=>invoke<{uri:string;name:string}>('Files','pick')};
export const Camera={capture:()=>invoke<{uri:string}>('Camera','capture')};
export const Notifications={show:(title:string,body:string)=>invoke<{shown:boolean}>('Notifications','show',{title,body})};
export const Biometrics={authenticate:(reason:string)=>invoke<{authenticated:boolean}>('Biometrics','authenticate',{reason})};
export const SQLite={execute:(sql:string,args:unknown[]=[])=>invoke<{rowsAffected:number}>('SQLite','execute',{sql,args}),query:<T=Record<string,unknown>>(sql:string,args:unknown[]=[])=>invoke<{rows:T[]}>('SQLite','query',{sql,args})};

export const Mobix={
 isNative:()=>typeof window!=='undefined'&&typeof window.mobixBridge?.postMessage==='function',
 negotiate,dispose,
 on:(event:string,handler:(data:unknown)=>void)=>{
  if(typeof window==='undefined')throw new Error('Mobix events require a browser');
  if(typeof event!=='string'||!eventName.test(event))throw new Error('Invalid event name');
  if(typeof handler!=='function')throw new Error('Invalid event handler');
  const listener=(e:Event)=>handler((e as CustomEvent).detail);
  const off=()=>{window.removeEventListener('mobix:'+event,listener);subscriptions.delete(off)};
  subscriptions.add(off);window.addEventListener('mobix:'+event,listener);return off;
 }
};
