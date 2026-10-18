import {test} from 'node:test';import {strict as assert} from 'node:assert';import {createBuildRequest} from '../packages/cloud-build/index.js';
test('build request validates platform',()=>{assert.equal(createBuildRequest({platform:'android',gitRef:'main'}).platform,'android');assert.throws(()=>createBuildRequest({platform:'windows',gitRef:'main'}));});
