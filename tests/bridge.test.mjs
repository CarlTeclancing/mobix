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
