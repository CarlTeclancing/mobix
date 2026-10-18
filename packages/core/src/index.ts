export type NativeRequest={v:1;id:string;plugin:string;method:string;params:Record<string,unknown>};
export type NativeResponse={v:1;id:string;ok:true;result:unknown}|{v:1;id:string;ok:false;error:{code:string;message:string}};
export type MobixPluginManifest={name:string;version:string;protocol:1;methods:string[];permissions?:string[]};
export type InvokeOptions={signal?:AbortSignal;timeoutMs?:number};
type Pending={resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>;cleanup:()=>void};
const pending=new Map<string,Pending>();
declare global {interface Window {mobixBridge?:{postMessage:(message:string)=>void};__mobixReceive?:(message:string)=>void}}
if(typeof window!=='undefined') window.__mobixReceive=(payload:string)=>{
 let response:NativeResponse;try{if(payload.length>1048576)return;response=JSON.parse(payload)}catch{return}
 if(response && response.v===1 && (response as any).type==='event'){
  const evt=response as any;
  if(typeof evt.name==='string' && /^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$/.test(evt.name))
    window.dispatchEvent(new CustomEvent('mobix:'+evt.name,{detail:evt.data}));
  return;
 }
 if(!response||response.v!==1||typeof response.id!=='string'||typeof response.ok!=='boolean')return;
 const request=pending.get(response.id);if(!request)return;
 pending.delete(response.id);clearTimeout(request.timer);request.cleanup();
 if(response.ok)request.resolve(response.result);else {const error=response.error;request.reject(new Error(typeof error?.code==='string' && typeof error?.message==='string'?`${error.code}: ${error.message}`:'MALFORMED_RESPONSE: Invalid native error'));}
};
export function invoke<T>(plugin:string,method:string,params:Record<string,unknown>={},options:InvokeOptions={}):Promise<T>{
 if(typeof window==='undefined'||!window.mobixBridge)return Promise.reject(new Error('Mobix native runtime unavailable. Launch inside Android app.'));
 if(!params||typeof params!=='object'||Array.isArray(params))return Promise.reject(new Error('Invalid native parameters'));
 if(!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(plugin)||!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(method))return Promise.reject(new Error('Invalid plugin or method'));
 if(options.signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
 const id=crypto.randomUUID();const request:NativeRequest={v:1,id,plugin,method,params};let payload:string;try{payload=JSON.stringify(request)}catch{return Promise.reject(new Error('Parameters must be JSON serializable'))}
 if(payload.length>65536)return Promise.reject(new Error('Request exceeds 64KiB limit'));
 return new Promise<T>((resolve,reject)=>{
  const timeout=options.timeoutMs??30000;
  if(!Number.isFinite(timeout)||timeout<1||timeout>300000){reject(new Error('Invalid timeout'));return}
  const abort=()=>{if(pending.delete(id)){clearTimeout(timer);cleanup();reject(new DOMException('Aborted','AbortError'))}};
  const cleanup=()=>options.signal?.removeEventListener('abort',abort);
  const timer=setTimeout(()=>{pending.delete(id);cleanup();reject(new Error('TIMEOUT: native request exceeded timeout'))},timeout);
  options.signal?.addEventListener('abort',abort,{once:true});
  pending.set(id,{resolve,reject,timer,cleanup});try{window.mobixBridge!.postMessage(payload)}catch(error){clearTimeout(timer);pending.delete(id);cleanup();reject(error)}
 });
}
export const Device={getInfo:()=>invoke<{platform:string;osVersion:string;model:string}>('Device','getInfo')};
export const Storage={get:async(key:string)=>(await invoke<{value:string|null}>('Storage','get',{key})).value,set:(key:string,value:string)=>invoke<{saved:boolean}>('Storage','set',{key,value}),remove:(key:string)=>invoke<{removed:boolean}>('Storage','remove',{key})};

export const Navigation={openExternal:(url:string)=>invoke<{opened:boolean}>('Navigation','openExternal',{url})};
export const Files={pick:()=>invoke<{uri:string;name:string}>('Files','pick')};
export const Camera={capture:()=>invoke<{uri:string}>('Camera','capture')};
export const Notifications={show:(title:string,body:string)=>invoke<{shown:boolean}>('Notifications','show',{title,body})};
export const Biometrics={authenticate:(reason:string)=>invoke<{authenticated:boolean}>('Biometrics','authenticate',{reason})};
export const SQLite={execute:(sql:string,args:unknown[]=[])=>invoke<{rowsAffected:number}>('SQLite','execute',{sql,args}),query:<T=Record<string,unknown>>(sql:string,args:unknown[]=[])=>invoke<{rows:T[]}>('SQLite','query',{sql,args})};
export const Mobix={isNative:()=>typeof window!=='undefined'&&!!window.mobixBridge,on:(event:string,handler:(data:unknown)=>void)=>{if(typeof window==='undefined')throw new Error('Mobix events require a browser');if(!/^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$/.test(event))throw new Error('Invalid event name');const listener=(e:Event)=>handler((e as CustomEvent).detail);window.addEventListener('mobix:'+event,listener);return()=>window.removeEventListener('mobix:'+event,listener)}};
