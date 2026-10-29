import test from 'node:test';
import assert from 'node:assert/strict';
import {usOnlyDataset} from '../src/us-scope.mjs';
import {officialTimeline} from '../src/registration-charts.mjs';
import {collectDataset} from '../scripts/collector-lib.mjs';
import {collectDiscovery,US_DISCOVERY_FEEDS} from '../scripts/discovery-lib.mjs';

test('US view excludes overseas rows without deleting or redating stored evidence',()=>{
 const stamp='2026-06-09T00:00:00Z',cities=[{id:'a',country:'US'},{id:'b',country:'US'},{id:'london',country:'GB'},{id:'seoul',country:'KR'}];
 const data={cities,observations:cities.map(c=>({city:c.id,asOf:stamp,count:1})),services:cities.map(c=>({city:c.id,observedAt:stamp})),news:cities.map(c=>({city:c.id,firstCollectedAt:stamp})),fleetResearch:cities.map(c=>({city:c.id})),fleetReferences:[{city:'a',scope:'metro'}],revisions:[{keep:'original'}]};const before=structuredClone(data),view=usOnlyDataset(data);
 assert.deepEqual(view.cities.map(c=>c.id),['a','b']);for(const field of ['observations','services','news','fleetResearch'])assert.equal(view[field].length,2);assert.equal(view.observations[0].asOf,stamp);assert.equal(view.fleetReferences[0].scope,'metro');assert.deepEqual(view.revisions,data.revisions);assert.deepEqual(data,before);
});

test('official model chart starts June9 but never invents historical model totals or daily growth',()=>{
 const row=(date,total,cc)=>({id:date,sourceId:'tx-tesla-official',scopeId:'us:state:TX:tesla:registered',basis:'registered',checkedAt:date+'T01:00:00Z',lastCheckedAt:date+'T01:00:00Z',valueAsOf:date+'T01:00:00Z',sourceUrl:'https://official.test',total,cybercab:cc,model_y:507,unknown:0});
 const out=officialTimeline([row('2026-10-23',858,351),row('2026-10-24',927,420)],'all','2026-10-24T02:00:00Z','2026-06-09');assert.equal(out[0].day,'2026-06-09');assert.equal(out.at(-1).day,'2026-10-24');for(const r of out.filter(r=>r.day<'2026-10-23')){assert.equal(r.total,null);assert.equal(r.cybercab,null);assert.equal(r.model_y,null);assert.equal(r.dailyDeltaTotal,null);}assert.equal(out.find(r=>r.day==='2026-10-23').dailyDeltaTotal,null);assert.equal(out.at(-1).dailyDeltaCybercab,69);assert.equal(officialTimeline([row('2026-10-23',858,351)],'7','2026-10-24T02:00:00Z','2026-06-09').length,7);
});

test('US news collection only calls US feeds and preserves prior overseas evidence and first collection',async()=>{
 const xml='<rss><channel><item><title>Tesla Robotaxi USA plans</title><link>https://example.org/us-story</link></item></channel></rss>',calls=[],first='2026-10-23T01:00:00Z',now='2026-10-29T02:00:00Z';
 const original=await collectDiscovery(undefined,{fetcher:async()=>new Response(xml),now:first});original.items.push(...Array.from({length:300},(_,i)=>({id:'archived-'+i,title:'Tesla Robotaxi global candidate '+i,url:'https://example.org/archive/'+i,firstCollectedAt:first,feedId:'google-global'})));const prior=structuredClone(original);const next=await collectDiscovery(original,{scope:'US',now,fetcher:async url=>{calls.push(url);return new Response(xml);}});
 assert.deepEqual(calls,US_DISCOVERY_FEEDS.map(f=>f.url));assert.equal(next.scope,'US');assert.equal(next.items[0].firstCollectedAt,first);assert.equal(next.items[0].scopeMatches.US,now);assert.equal(next.lastRun.newCandidates,0);assert.equal(next.archivedItems.length,301);assert.ok(prior.items.every(item=>next.archivedItems.some(old=>old.id===item.id)));const retried=await collectDiscovery(next,{scope:'US',now:'2026-10-30T02:00:00Z',fetcher:async()=>new Response(xml)});assert.equal(retried.items[0].firstCollectedAt,first);assert.deepEqual(retried.archivedItems,next.archivedItems);assert.deepEqual(original,prior);
});


test('US official service extraction leaves archived overseas services and their dates unchanged',async()=>{
 const date='2026-06-09T00:00:00Z',cities=[{id:'austin',english:'Austin',country:'US'},{id:'london',english:'London',country:'GB'}],old={id:'tesla-service-london',city:'london',sourceId:'tesla-support',status:'limited',observedAt:date};
 const data={cities,sources:[{id:'tesla-support',url:'https://official.test'}],sourceRuns:[],observations:[],services:[old],news:[],revisions:[],runs:[]};
 const result=await collectDataset(data,{now:'2026-10-29T00:00:00Z',scopeCountry:'US',fetcher:async()=>new Response('<p>Currently, we provide service in limited areas of Austin and London.</p>'+'.'.repeat(350))});
 assert.equal(result.services.filter(r=>r.city==='austin').length,1);assert.deepEqual(result.services.find(r=>r.city==='london'),old);assert.ok(result.news.every(r=>r.city==='austin'));assert.equal(result.sourceRuns[0].state,'ok');assert.equal(data.services.length,1);
});
