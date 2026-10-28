import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshPublishedData} from '../src/published-data.mjs';
test('browser refresh reads newly published registration counts without replacing good data on partial failure',async()=>{
 const previous={atlas:{cities:[],observations:[{count:123}]},monitoring:{registries:[{total:1051}],jurisdictions:[]},statistics:{populations:[{asOf:'2025-07-01'}]},scenarios:{defaults:{austin:{}}}};
 const requests=[];const r=await refreshPublishedData(previous,{baseUrl:'/robotaxi-atlas/',now:42,fetcher:async(url,options)=>{requests.push({url,options});return url.includes('/monitoring.json')?Response.json({registries:[{total:1080,cybercab:573,model_y:507}],jurisdictions:[]}):new Response('',{status:503});}});
 assert.equal(r.data.monitoring.registries[0].total,1080);assert.deepEqual(r.data.atlas,previous.atlas);assert.deepEqual(r.data.statistics,previous.statistics);assert.deepEqual(r.data.scenarios,previous.scenarios);assert.equal(r.failed.length,3);assert.ok(requests.every(r=>r.options.cache==='no-store'&&r.url.endsWith('?at=42')));
 const broken=await refreshPublishedData(previous,{fetcher:async()=>Response.json({})});assert.deepEqual(broken.data,previous);assert.equal(broken.failed.length,4);
});
