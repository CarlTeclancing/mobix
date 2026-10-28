import test from 'node:test';
import assert from 'node:assert/strict';
const events = new EventTarget();
class NativeEvent extends Event { constructor(name, opts) { super(name); this.detail=opts.detail; } }
globalThis.CustomEvent = NativeEvent;
const sent=[];
globalThis.window = { mobixBridge:{postMessage: s => sent.push(JSON.parse(s))}, addEventListener:(...a)=>events.addEventListener(...a), removeEventListener:(...a)=>events.removeEventListener(...a), dispatchEvent:e=>events.dispatchEvent(e) };
const { invoke, Mobix } = await import('../packages/core/dist/index.js');
test('bridge returns successful responses', async () => {
 const promise=invoke('Device','getInfo'); const req=sent.at(-1);
 window.__mobixReceive(JSON.stringify({v:1,id:req.id,ok:true,result:{platform:'android'}}));
 assert.deepEqual(await promise,{platform:'android'});
});
test('bridge propagates native errors', async () => {
 const promise=invoke('Device','getInfo'); const req=sent.at(-1);
 window.__mobixReceive(JSON.stringify({v:1,id:req.id,ok:false,error:{code:'DENIED',message:'no permission'}}));
 await assert.rejects(promise,/DENIED: no permission/);
});
test('bridge rejects invalid identifiers and params', async () => {
 await assert.rejects(invoke('../bad','getInfo'),/Invalid plugin/);
 await assert.rejects(invoke('Device','getInfo',[]),/Invalid native parameters/);
 const cyclic={};cyclic.self=cyclic;
 await assert.rejects(invoke('Device','getInfo',cyclic),/JSON serializable/);
});
test('bridge cancellation clears pending and ignores late response', async () => {
 const controller=new AbortController(); const promise=invoke('Device','getInfo',{}, {signal:controller.signal}); const req=sent.at(-1);
 controller.abort(); await assert.rejects(promise, {name:'AbortError'});
 window.__mobixReceive(JSON.stringify({v:1,id:req.id,ok:true,result:{}}));
});
test('native event subscribe and unsubscribe', () => {
 const seen=[]; const off=Mobix.on('device.changed', data=>seen.push(data));
 window.__mobixReceive(JSON.stringify({v:1,type:'event',name:'device.changed',data:{online:true}}));
 off();window.__mobixReceive(JSON.stringify({v:1,type:'event',name:'device.changed',data:{online:false}}));
 assert.deepEqual(seen,[{online:true}]);
 assert.throws(()=>Mobix.on('bad event',()=>{}),/Invalid event/);
});
test('malformed native errors do not crash dispatcher', async () => {
 const promise=invoke('Device','getInfo');const req=sent.at(-1);
 window.__mobixReceive(JSON.stringify({v:1,id:req.id,ok:false}));
 await assert.rejects(promise,/MALFORMED_RESPONSE/);
});

test('timeout rejects and ignores late replies', async()=>{
 const promise=invoke('Device','getInfo',{}, {timeoutMs:5});const req=sent.at(-1);
 await assert.rejects(promise,{code:'TIMEOUT'});
 window.__mobixReceive(JSON.stringify({v:1,id:req.id,ok:true,result:null}));
});
test('version mismatch and malformed success reject immediately',async()=>{
 for(const response of [{v:2,ok:true,result:{}},{v:1,ok:true},{v:1,ok:'yes'}]){
  const promise=invoke('Device','getInfo');window.__mobixReceive(JSON.stringify({...response,id:sent.at(-1).id}));
  await assert.rejects(promise,{code:response.v===2?'VERSION_MISMATCH':'MALFORMED_RESPONSE'});
 }
});
test('unparseable and non-string messages are ignored',async()=>{
 const promise=invoke('Device','getInfo');const id=sent.at(-1).id;
 for(const raw of [null,42,'{','null','[]'])window.__mobixReceive(raw);
 window.__mobixReceive(JSON.stringify({v:1,id,ok:true,result:null}));assert.equal(await promise,null);
});
test('pre-abort and invalid timeouts never send',async()=>{
 const count=sent.length;const c=new AbortController();c.abort();
 await assert.rejects(invoke('Device','getInfo',{}, {signal:c.signal}),{name:'AbortError'});
 for(const timeoutMs of [0,NaN,Infinity,300001])await assert.rejects(invoke('Device','getInfo',{}, {timeoutMs}),/Invalid timeout/);
 assert.equal(sent.length,count);
});
test('transport errors have serializable codes',async()=>{
 const original=window.mobixBridge.postMessage;window.mobixBridge.postMessage=()=>{throw 'private detail'};
 try{await assert.rejects(invoke('Device','getInfo'),e=>e.code==='TRANSPORT_ERROR'&&e.toJSON().message==='Native transport failed')}
 finally{window.mobixBridge.postMessage=original}
});
test('pagehide clears requests and subscriptions',async()=>{
 let calls=0;Mobix.on('test.event',()=>calls++);const promise=invoke('Device','getInfo');
 events.dispatchEvent(new Event('pagehide'));
 await assert.rejects(promise,{code:'RUNTIME_DISPOSED'});
 window.__mobixReceive(JSON.stringify({v:1,type:'event',name:'test.event',data:null}));assert.equal(calls,0);
});
test('explicit version negotiation validates result',async()=>{
 const promise=Mobix.negotiate();const req=sent.at(-1);assert.equal(req.plugin,'Bridge');
 window.__mobixReceive(JSON.stringify({v:1,id:req.id,ok:true,result:{protocol:1}}));assert.deepEqual(await promise,{protocol:1});
});
