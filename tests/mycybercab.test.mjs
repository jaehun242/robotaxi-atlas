import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMyCybercab,collectMyCybercab,MYCYBERCAB_URL} from '../scripts/mycybercab-lib.mjs';
const NOW='2026-10-29T08:00:00.000Z',LATER='2026-10-30T08:00:00.000Z';
const row=(label,count)=>'<div class="gcc-stat-row"><span class="gcc-stat-label">'+label+'</span><span class="gcc-stat-val">'+count+'</span></div>';
function fixture({claim='573+',registered='999',date='TxDMV · 10/27/2026 &middot; @robotaxi · OCT 27th',includeClaim=true}={}){
 return '<main><div class="grid-city-card"><div class="gcc-head"><div class="gcc-name">Austin, TX</div><div class="gcc-pill live">LIVE CYBERCAB</div></div>'+row('Registered (TX)',registered)+(includeClaim?row('Official fleet claim',claim):'')+row('Unique seen (community)','44')+'<div class="gcc-source">Sources: '+date+'</div></div><div class="grid-city-card wild"><div class="gcc-name">Everywhere Else</div>'+row('Official fleet claim','9999')+'</div></main>';
}
const response=html=>async url=>{assert.equal(url,MYCYBERCAB_URL);return new Response(html,{headers:{'Content-Type':'text/html'}});};
test('Austin claim is distinct from statewide registrations, sightings and other cities; plus remains lower bound',()=>{
 const r=parseMyCybercab(fixture(),{now:NOW});assert.equal(r.count,573);assert.equal(r.countQualifier,'at_least');assert.equal(r.displayCount,'573+');assert.equal(r.city,'austin');assert.equal(r.basis,'reported_fleet');assert.equal(r.verification,'unofficial');assert.equal(r.asOf,'2026-10-27');assert.equal(r.timezone,null);assert.equal(r.sourceDateYearContext,'explicit_card_date');assert.ok(!JSON.stringify(r).includes('"vin"'));
});
test('exact values and HTML plus entities keep their actual source qualifiers',()=>{
 assert.equal(parseMyCybercab(fixture({claim:'1,234'}),{now:NOW}).count,1234);
 assert.equal(parseMyCybercab(fixture({claim:'1,234'}),{now:NOW}).countQualifier,'exact');
 assert.equal(parseMyCybercab(fixture({claim:'573&#43;'}),{now:NOW}).countQualifier,'at_least');
 assert.equal(parseMyCybercab(fixture({claim:'0'}),{now:NOW}).count,0);
});
test('no claim value is inferred from registered-only cards or ambiguous/unsafe claim rows',()=>{
 for(const html of [fixture({includeClaim:false}),fixture().replace(row('Official fleet claim','573+'),row('Official fleet claim','573+')+row('Official fleet claim','574+')),fixture()+fixture(),fixture({claim:'~573'}),fixture({claim:'-1'}),fixture({claim:'1.5'}),fixture({claim:'9007199254740992'})])assert.throws(()=>parseMyCybercab(html,{now:NOW}));
});
test('script/template text cannot supply an Austin claim; incomplete cards are rejected',()=>{
 assert.throws(()=>parseMyCybercab('<script>'+fixture()+'</script>',{now:NOW}));
 assert.throws(()=>parseMyCybercab(fixture().replace('</main>','').slice(0,-30),{now:NOW}));
});
test('short claim day uses explicit publisher year context, never current collection year',()=>{
 const r=parseMyCybercab(fixture({date:'@robotaxi · OCT 27th'}),{now:NOW});assert.equal(r.asOf,null);assert.equal(r.datePrecision,'unknown');assert.equal(r.sourceDateText,'OCT 27th');
 assert.equal(parseMyCybercab(fixture({date:'TxDMV · 10/29/2026 · @robotaxi · OCT 27th'}),{now:LATER}).asOf,'2026-10-27');
 assert.equal(parseMyCybercab(fixture({date:'@robotaxi · Oct 27th, 2026'}),{now:NOW}).asOf,'2026-10-27');
 assert.throws(()=>parseMyCybercab(fixture({date:'@robotaxi · Feb 30th, 2026'}),{now:NOW}));
 assert.throws(()=>parseMyCybercab(fixture({date:'@robotaxi · Oct 27th, 2027'}),{now:NOW}));
});
test('same claim rerun preserves original asOf, first collection, observation clock and corrections',async()=>{
 const first=await collectMyCybercab(null,{now:NOW,fetcher:response(fixture())}),again=await collectMyCybercab(first,{now:LATER,fetcher:response(fixture())});
 assert.equal(first.checkState,'ok');assert.equal(again.asOf,'2026-10-27');assert.equal(again.firstCollectedAt,NOW);assert.equal(again.observedAt,NOW);assert.equal(again.fetchedAt,LATER);assert.equal(again.lastSuccessAt,LATER);assert.equal(again.revisions.length,0);assert.equal(again.contentHash,first.contentHash);
});
test('a count change preserves stale publisher date instead of changing its date to collection time',async()=>{
 const first=await collectMyCybercab(null,{now:NOW,fetcher:response(fixture())}),changed=await collectMyCybercab(first,{now:LATER,fetcher:response(fixture({claim:'580+'}))});
 assert.equal(changed.count,580);assert.equal(changed.asOf,'2026-10-27');assert.equal(changed.observedAt,LATER);assert.equal(changed.firstCollectedAt,NOW);assert.equal(changed.revisions.length,1);assert.equal(changed.revisions[0].previous.count,573);
});
test('blocked/parse/forced failures retain last good count, qualifier, asOf and success clock',async()=>{
 const first=await collectMyCybercab(null,{now:NOW,fetcher:response(fixture())});
 for(const options of [{fetcher:async()=>new Response('',{status:403})},{fetcher:response(fixture({includeClaim:false}))},{forceFailure:true}]){
  const failed=await collectMyCybercab(first,{now:LATER,...options});assert.equal(failed.checkState,'failed');for(const key of ['count','countQualifier','asOf','sourceAsOf','observedAt','firstCollectedAt','lastSuccessAt','fetchedAt'])assert.equal(failed[key],first[key]);assert.equal(failed.lastAttemptAt,LATER);
 }
});
test('network retry count is bounded and 403 is not retried',async()=>{
 let calls=0;await collectMyCybercab(null,{now:NOW,fetcher:async()=>{calls++;return new Response('',{status:403});}});assert.equal(calls,1);
 calls=0;await collectMyCybercab(null,{now:NOW,fetcher:async()=>{calls++;throw Error('temporary');}});assert.equal(calls,2);
});

test('updates to the separate Texas citation do not invent a new Austin fleet observation',async()=>{
 const first=await collectMyCybercab(null,{now:NOW,fetcher:response(fixture())});
 const changedCitation=await collectMyCybercab(first,{now:LATER,fetcher:response(fixture({date:'TxDMV · 10/29/2026 · @robotaxi · OCT 27th',registered:'600'}))});
 assert.equal(changedCitation.count,573);assert.equal(changedCitation.asOf,'2026-10-27');assert.equal(changedCitation.observedAt,NOW);assert.equal(changedCitation.revisions.length,0);assert.equal(changedCitation.lastSuccessAt,LATER);
});
