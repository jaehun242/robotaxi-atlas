import test from 'node:test';import assert from 'node:assert/strict';
import {fleetLinePoints} from '../src/registration-charts.mjs';
test('fleet lines keep real date distances and separate missing-day connectors from observations',()=>{
 const rows=[{day:'2026-10-24',n:420},{day:'2026-10-25',n:431},{day:'2026-10-26',n:null},{day:'2026-10-27',n:null},{day:'2026-10-28',n:573}];
 const r=fleetLinePoints(rows,'n');assert.deepEqual(r.values,[420,431,null,null,573]);assert.equal(r.times[4]-r.times[1],3*86400000);assert.deepEqual(r.gaps,[{start:1,end:4,days:3}]);assert.equal(rows[2].n,null);
 const source=fleetLinePoints(rows,'n',{publisherDates:true});assert.equal(source.times[0]-r.times[0],9*3600000);
});
test('log geometry excludes nonpositive plot points without changing CSV values or bridging known zeros',()=>{
 const rows=[{day:'2026-10-23',n:10},{day:'2026-10-24',n:0},{day:'2026-10-25',n:-1},{day:'2026-10-26',n:null},{day:'2026-10-27',n:100}];
 const r=fleetLinePoints(rows,'n',{log:true});assert.deepEqual(r.values,[10,null,null,null,100]);assert.deepEqual(r.raw,[10,0,-1,null,100]);assert.equal(r.excluded,2);assert.deepEqual(r.gaps,[]);assert.equal(rows[1].n,0);
 assert.deepEqual(fleetLinePoints(rows,'n').values,[10,0,-1,null,100]);
});
