import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCityClaims} from '../scripts/city-claims-lib.mjs';
import {preferredCityClaim} from '../src/preferred-city-claim.mjs';
import {aggregate} from '../src/domain.mjs';
const now='2026-10-29T09:00:00Z';
const html='<div class="grid-city-card"><div class="gcc-name">Austin, TX</div><div class="gcc-stat-row"><span class="gcc-stat-label">Registered (TX)</span><span class="gcc-stat-val">999</span></div><div class="gcc-stat-row"><span class="gcc-stat-label">Official fleet claim</span><span class="gcc-stat-val">573+</span></div><div class="gcc-source">TxDMV · 10/27/2026 · @robotaxi · OCT 27th</div></div>';
test('chosen city source persists independently and failures preserve source day and observation history',async()=>{
 const data={cities:[{id:'austin',country:'US'}],sources:[],sourceRuns:[],observations:[{city:'austin',model:'cybercab',count:229},{city:'austin',model:'model_y',count:236}],revisions:[],registrationHistory:[{total:1080,cybercab:573,model_y:507}]};
 const before=structuredClone(data),next=await collectCityClaims(data,{now,fetcher:async()=>new Response(html)});
 assert.deepEqual(data,before);assert.deepEqual(next.observations,data.observations);assert.deepEqual(next.registrationHistory,data.registrationHistory);
 assert.equal(aggregate(next.observations).total,465);
 const claim=preferredCityClaim(next,{basis:'observed',verification:'credible'},'austin','cybercab');assert.equal(claim.count,573);assert.equal(claim.countQualifier,'at_least');
 const failed=await collectCityClaims(next,{now:'2026-10-30T09:00:00Z',forceFailure:true});
 assert.equal(failed.cityFleetClaims[0].asOf,'2026-10-27');assert.equal(failed.cityFleetClaims[0].count,573);assert.equal(failed.cityFleetClaims[0].lastSuccessAt,now);assert.equal(failed.cityFleetClaims[0].checkState,'failed');
 assert.equal(preferredCityClaim(failed,{basis:'observed',verification:'credible'},'austin','cybercab').count,573);
 assert.deepEqual(failed.observations,before.observations);assert.equal(failed.sourceRuns.length,1);
});

