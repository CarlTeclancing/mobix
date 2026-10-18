import {test} from 'node:test';import {strict as assert} from 'node:assert';import {createRegistry} from '../packages/plugin-sdk/index.js';
test('registry enforces unique names',()=>{const r=createRegistry();r.register({name:'Demo',protocol:1,version:'1.0',methods:{}});assert.deepEqual(r.list(),['Demo']);assert.throws(()=>r.register({name:'Demo',protocol:1}));});
test('registry rejects incompatible protocol',()=>{assert.throws(()=>createRegistry().register({name:'Demo',protocol:2}));});
