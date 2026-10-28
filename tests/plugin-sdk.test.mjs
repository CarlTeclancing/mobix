import {test} from 'node:test';import {strict as assert} from 'node:assert';import {createRegistry} from '../packages/plugin-sdk/index.js';
test('registry enforces unique names',()=>{const r=createRegistry();r.register({name:'Demo',protocol:1,version:'1.0',methods:{}});assert.deepEqual(r.list(),['Demo']);assert.throws(()=>r.register({name:'Demo',protocol:1}));});
test('registry rejects incompatible protocol',()=>{assert.throws(()=>createRegistry().register({name:'Demo',protocol:2}));});

test('registry rejects malformed methods and permissions and snapshots input',()=>{
 const registry=createRegistry();
 for(const extra of [{methods:{bad:1}},{permissions:'camera'},{version:''}])
  assert.throws(()=>registry.register({name:'Demo',protocol:1,version:'1',methods:{},...extra}));
 const plugin={name:'Demo',protocol:1,version:'1',methods:{run:async()=>1},permissions:['camera']};
 registry.register(plugin);plugin.permissions.push('files');plugin.methods.other=()=>2;
 assert.deepEqual(registry.get('Demo').permissions,['camera']);assert.equal(registry.get('Demo').methods.other,undefined);
});
