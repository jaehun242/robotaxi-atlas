import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {monitorDocument,coverageSummary} from '../scripts/monitoring-lib.mjs';
import {summarizeVehicles,fetchTexasRegistry,preserveRegistration} from '../scripts/registration-lib.mjs';
import {parseNewsFeed,collectDiscovery} from '../scripts/discovery-lib.mjs';
import {parseSafetyPlans,collectSafety} from '../scripts/safety-lib.mjs';
import {calculateMarket} from '../src/market.mjs';
const now='2026-10-23T07:00:00Z',later='2026-10-24T07:00:00Z';
const config={code:'TEST',name:'Test',agency:'Test DOT',url:'https://example.test/av',researchStatus:'reviewed',countDisclosure:'not_extracted'};
const doc='<h1>Autonomous vehicle program</h1><p>'+'.'.repeat(200)+'</p>';
test('all 50 states plus DC have unique actual source URLs; overseas checks are separate',async()=>{
 const a=JSON.parse(await readFile('data/jurisdictions-a-m.json','utf8')),b=JSON.parse(await readFile('data/jurisdictions-mt-wy.json','utf8'));
 const rows=[...a,...b];assert.equal(rows.length,51);assert.equal(new Set(rows.map(r=>r.code)).size,51);assert.ok(rows.some(r=>r.code==='DC'));
 assert.ok(rows.every(r=>new URL(r.url).protocol==='https:'&&r.agency&&r.information&&r.reason));
});
test('document checking preserves source dates and distinguishes baseline, no-change, change and failure',async()=>{
 const a=await monitorDocument(config,null,{now,fetcher:async()=>new Response(doc)});assert.equal(a.status,'success_baseline');assert.equal(a.referenceDate,null);
 const b=await monitorDocument(config,a,{now:later,fetcher:async()=>new Response(doc)});assert.equal(b.status,'success_unchanged');assert.equal(b.quantityStatus,'not_extracted');
 const c=await monitorDocument(config,b,{now:later,fetcher:async()=>new Response(doc+'new text')});assert.equal(c.status,'success_changed');
 let calls=0;const d=await monitorDocument(config,c,{now:later,fetcher:async()=>{calls++;return new Response('',{status:403});}});
 assert.equal(calls,1);assert.equal(d.status,'access_failed');assert.equal(d.contentHash,c.contentHash);assert.equal(d.lastSuccessAt,c.lastSuccessAt);
 const missing=await monitorDocument({...config,researchStatus:'authority_only'},null,{now,fetcher:async()=>{throw Error('must not fetch');}});assert.equal(missing.status,'unconnected');assert.equal(missing.lastCheckedAt,undefined);
});
test('HTTP200 challenges, loading shells, wrong PDF and oversize are not collection successes',async()=>{
 for(const html of ['<title>Loading...</title>'+doc,'Request rejected '+doc])assert.equal((await monitorDocument(config,null,{now,fetcher:async()=>new Response(html)})).status,'extraction_failed');
 assert.equal((await monitorDocument({...config,url:'https://example.test/doc.pdf'},null,{now,fetcher:async()=>new Response(doc)})).status,'extraction_failed');
 assert.equal((await monitorDocument(config,null,{now,fetcher:async()=>new Response(doc,{headers:{'content-length':'102000000'}})})).status,'extraction_failed');
});
const vehicle=(i,model)=>({vin:'5YJ'+String(i).padStart(14,'0'),make:'Tesla',model,modelYear:2026});
test('official registrations normalize aliases and VIN case, deduplicate and reconcile pages',async()=>{
 const records=[vehicle(1,'Cybercab'),vehicle(2,'cybercab'),vehicle(3,'Model Y'),vehicle(3,'Model Y')];
 const a=summarizeVehicles(records,3);assert.equal(a.cybercab,2);assert.equal(a.model_y,1);assert.equal(a.total,3);assert.equal(a.duplicateRecords,1);assert.ok(!JSON.stringify(a).includes(records[0].vin));
 assert.throws(()=>summarizeVehicles(records,4));assert.throws(()=>summarizeVehicles([...records,vehicle(1,'Model Y')],3));
 let calls=0;const r=await fetchTexasRegistry(async url=>{calls++;const offset=Number(new URL(url).searchParams.get('offset'));return Response.json({total:201,vehicles:Array.from({length:Math.min(100,201-offset)},(_,i)=>vehicle(offset+i,'Model Y'))});});
 assert.equal(calls,3);assert.equal(r.total,201);assert.equal(r.model_y,201);
 const old=preserveRegistration(null,a,now),same=preserveRegistration(old,a,later);assert.equal(same.asOf,now);assert.equal(same.lastCheckedAt,later);assert.equal(same.firstCollectedAt,now);
});
test('RSS discovery is read-only evidence candidates and preserves original first collection',async()=>{
 const xml='<rss><channel><item><title>Tesla Robotaxi plans</title><link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.org%2Farticle</link><pubDate>Fri, 23 Oct 2026 03:00:00 GMT</pubDate></item></channel></rss>';
 const rows=parseNewsFeed(xml,{id:'test'},now);assert.equal(rows.length,1);assert.equal(rows[0].url,'https://example.org/article');assert.equal(rows[0].verification,'discovery_only');
 const a=await collectDiscovery(undefined,{fetcher:async()=>new Response(xml),now}),b=await collectDiscovery(a,{fetcher:async()=>new Response(xml),now:later});
 assert.equal(b.items.length,1);assert.equal(b.items[0].firstCollectedAt,now);assert.equal(b.lastRun.newCandidates,0);
});
test('official coming-soon facts add reviewed geography as planned, never counts or commercial service',async()=>{
 const data=JSON.parse(await readFile('public/data/atlas.json','utf8')),catalog=JSON.parse(await readFile('data/approved-regions.json','utf8'));
 const without={...data,cities:data.cities.filter(c=>!catalog.regions.some(r=>r.id===c.id)),services:[],news:[]};
 const html='<script type="application/json" data-info="react-data-tesla_robotaxi_graph_1">'+JSON.stringify({data:{comingSoonCities:catalog.regions.map(r=>({t_name:r.discoveryNames[0]}))}})+'</script>';
 assert.equal(parseSafetyPlans(html).names.length,4);
 const a=await collectSafety(without,catalog,{fetcher:async()=>new Response(html),now});assert.equal(a.cities.length,without.cities.length+4);assert.ok(a.services.every(s=>s.status==='planned'&&!s.paid&&s.model==='unspecified'&&s.asOf===null));
 assert.deepEqual(a.observations,without.observations);
 const b=await collectSafety(a,catalog,{fetcher:async()=>new Response('',{status:403}),now:later});assert.deepEqual(a.services,b.services);assert.deepEqual(a.news,b.news);assert.deepEqual(a.cities,b.cities);
});
test('price-induced trips apply once after substitution; higher productivity may reduce fleet despite higher demand',async()=>{
 const scenarios=JSON.parse(await readFile('public/data/scenarios.json','utf8'));const input=structuredClone(scenarios.defaults.austin.current);input.scenarios.forEach(s=>s.inducedDemand='0');const base=calculateMarket(input);
 input.scenarios[1].inducedDemand='10';const r=calculateMarket(input);assert.ok(Math.abs(r.results[1].paidTrips-base.results[1].paidTrips*1.1)<1e-8);assert.equal(r.targetVehicleTrips,base.targetVehicleTrips);assert.ok(r.results[1].inducedPaidTrips>0);
});
test('today coverage excludes stale and unconnected records; semantic parsers have independent count',()=>{
 const rows=[{status:'success_unchanged',lastCheckedAt:now,numericParserConnected:true},{status:'access_failed',lastCheckedAt:now},{status:'extraction_failed',lastCheckedAt:now},{status:'unconnected'},{status:'success_unchanged',lastCheckedAt:'2026-10-21T00:00:00Z'}];
 const s=coverageSummary(rows,now);assert.equal(s.checkedToday,3);assert.equal(s.success,1);assert.equal(s.accessFailed,1);assert.equal(s.extractionFailed,1);assert.equal(s.unconnected,1);assert.equal(s.numericParsers,1);
});
