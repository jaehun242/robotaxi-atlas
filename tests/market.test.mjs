import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {blankMarket,illustration,calculateMarket,compareFleet,productivityFromTime,uniquePopulation,MODEL_VERSION} from '../src/market.mjs';
import {censusRecords,mergeStatistics,boundedFetch,US_GEOGRAPHIES} from '../scripts/statistics-lib.mjs';
const base=()=>({...illustration(blankMarket('austin','us:place:4805000')),referenceDate:'2026-10-23'});
const fleet=(more={})=>['cybercab','model_y'].map((model,i)=>({id:model,city:'austin',model,count:[10,20][i],basis:'deployed',asOf:'2026-10-23T00:00:00Z',scopeId:'us:place:4805000',coverageComplete:true,vehicleDefinition:'tesla_owned_fleet',...more}));
test('no source-free default demand, share or production; missing is not zero',()=>{
 const b=blankMarket('austin','us:place:4805000'),r=calculateMarket(b);
 assert.equal(b.replacement,'');assert.ok(b.scenarios.every(s=>s.conversion===''&&s.teslaShare===''&&s.teslaProductivity===''));
 assert.equal(r.targetVehicleTrips,null);assert.ok(!r.coherent);assert.ok(r.results.every(s=>s.teslaFleet===null));
 const zero=calculateMarket({...base(),replacement:'0'});assert.ok(zero.coherent);assert.ok(zero.results.every(r=>r.marketFleet===0&&r.teslaFleet===0));
});
test('market and Tesla demand/owned-fleet productivity are separate',()=>{
 const r=calculateMarket(base());assert.ok(r.coherent);
 assert.deepEqual(r.results.map(x=>x.marketFleet),[400,1200,2400]);assert.deepEqual(r.results.map(x=>x.teslaFleet),[34,200,600]);
 assert.equal(r.results[0].paidTrips,10000);assert.equal(r.results[0].teslaPaidTrips,1000);
 const same=base();same.scenarios=same.scenarios.map(s=>({...s,teslaProductivity:'25'}));assert.equal(calculateMarket(same).results[0].teslaFleet,40);
});
test('person trips need an explicit occupancy conversion',()=>{
 const draft={...base(),unit:'person_trips',replacement:'200000',occupancy:''};assert.ok(calculateMarket(draft).errors.length);
 const r=calculateMarket({...draft,occupancy:'2'});assert.equal(r.targetVehicleTrips,100000);assert.deepEqual(r.results,calculateMarket(base()).results);
});
test('expanded/private and airport/visitor demand are not double-counted',()=>{
 const d={...base(),market:'expanded',additional:'20000'};assert.ok(calculateMarket(d).errors.length);
 assert.equal(calculateMarket({...d,additionalDistinct:true}).targetVehicleTrips,120000);
 const e={...base(),externalEnabled:true,external:'1000',externalDistinct:false};assert.ok(calculateMarket(e).errors.length);
 assert.equal(calculateMarket({...e,externalDistinct:true}).targetVehicleTrips,101000);
 assert.ok(calculateMarket({...e,externalDistinct:true,sourceIncludesExternal:true}).errors.length);
 assert.equal(calculateMarket({...base(),additional:'999999'}).targetVehicleTrips,100000);
});
test('2030 uses explicit demand growth, not a population multiplier',()=>{
 const d={...base(),horizon:'2030',referenceDate:'2025-12-31',growth:''};assert.ok(calculateMarket(d).errors.length);
 const r=calculateMarket({...d,growth:'10'});assert.ok(Math.abs(r.targetVehicleTrips-161051)<.00001);assert.equal(r.growthFactor,1.6105100000000006);
 assert.ok(calculateMarket({...d,growth:'1e100'}).errors.length);
});
test('scenario assumptions and results must be ordered consistently',()=>{
 const d=base();d.scenarios[2].marketProductivity='99999';const r=calculateMarket(d);assert.ok(!r.coherent);assert.ok(r.warnings.length);
 const reversed=base();reversed.scenarios[1].teslaShare='1';assert.ok(!calculateMarket(reversed).coherent);
 const impossible=base();impossible.scenarios[0].teslaProductivity='.01';assert.ok(calculateMarket(impossible).results[0].errors.some(e=>e.includes('전체 시장')));
 const allTesla=base();allTesla.scenarios=allTesla.scenarios.map(s=>({...s,teslaShare:'100'}));assert.ok(calculateMarket(allTesla).results[0].errors.some(e=>e.includes('100%')));
 const small=base();small.replacement='1';assert.ok(calculateMarket(small).results[0].errors.some(e=>e.includes('이외 수요')));
});
test('time productivity includes non-paid travel and downtime once',()=>{
 const budget={hours:'24',paidMinutes:'20',pickupMinutes:'5',emptyMinutes:'5',chargeMinutes:'120',cleanMinutes:'30',maintenanceMinutes:'30',otherDowntimeMinutes:'60'};
 const r=productivityFromTime(budget);assert.equal(r.availableMinutes,1200);assert.equal(r.cycleMinutes,30);assert.equal(r.value,40);
 assert.equal(productivityFromTime({...budget,hours:'1'}).value,null);assert.equal(productivityFromTime({hours:'24'}).value,null);
});
test('future model mix is absent by default and optional counts sum exactly',()=>{
 const r=calculateMarket(base());assert.ok(r.results.every(r=>r.cybercab===null&&r.modelY===null));
 const s=calculateMarket({...base(),mix:'37'});assert.ok(s.results.every(r=>r.cybercab+r.modelY===r.teslaFleet));
});
test('current comparisons require matching geography, date, owned fleet and full two-model coverage',()=>{
 const d=base(),calc=calculateMarket(d),r=compareFleet(fleet(),d,calc);assert.ok(r.allowed);assert.equal(r.count,30);assert.equal(r.additional[0],4);assert.equal(r.ratios[0],30/34);
 for(const change of [{scopeId:'us:cbsa:12420'},{asOf:'2026-10-22T00:00:00Z'},{vehicleDefinition:'commercial_active'},{coverageComplete:false},{coverageComplete:'false'}]) assert.ok(!compareFleet(fleet(change),d,calc).allowed);
 assert.ok(!compareFleet(fleet().slice(0,1),d,calc).allowed);
 assert.ok(!compareFleet(fleet(),{...d,horizon:'2030'},calc).allowed);
 assert.equal(compareFleet([],d,calc).count,null);
});
test('zero target comparison has undefined ratio, never Infinity',()=>{
 const d={...base(),replacement:'0'},calc=calculateMarket(d),r=compareFleet(fleet(),d,calc);
 assert.ok(r.allowed);assert.deepEqual(r.ratios,[null,null,null]);assert.deepEqual(r.additional,[0,0,0]);
});
test('metro populations deduplicate; city and metro populations never add',()=>{
 const a={scopeId:'us:cbsa:1',kind:'metro',asOf:'2025-07-01',value:100};assert.equal(uniquePopulation([a,{...a}]),100);
 assert.throws(()=>uniquePopulation([a,{...a,kind:'city'}]));assert.throws(()=>uniquePopulation([a,{...a,scopeId:'other',asOf:'2024-07-01'}]));
});
test('unchanged statistics preserve source dates; revisions are separate from fleet history',()=>{
 const row={id:'city-a',scopeId:'a',kind:'city',value:100,asOf:'2025-07-01',vintage:'2025',firstCollectedAt:'2026-01-01',changedAt:'2026-01-01'};
 const data={populations:[row],updatedAt:'2026-01-01',revisions:[]};const same=mergeStatistics(data,[{...row,firstCollectedAt:'2026-10-23',changedAt:'2026-10-23'}],'2026-10-23');assert.deepEqual(same,data);
 const corrected=mergeStatistics(data,[{...row,value:101}],'2026-10-23');assert.equal(corrected.populations[0].asOf,'2025-07-01');assert.equal(corrected.populations[0].firstCollectedAt,'2026-01-01');assert.equal(corrected.revisions[0].previous.value,100);
});
test('Census reader selects incorporated place totals, not county fragments',()=>{
 const csv='SUMLEV,STATE,PLACE,NAME,STNAME,POPESTIMATE2025\n'+US_GEOGRAPHIES.flatMap((g,i)=>[`157,${g.state},${g.place},City,State,99999`,`162,${g.state},${g.place},City,State,${1000+i}`]).join('\n');
 const records=censusRecords(csv,'city','https://www2.census.gov/test','2026-10-23');assert.equal(records.length,7);assert.equal(records[0].value,1000);assert.equal(records[0].scopeId,'us:place:4805000');
 assert.throws(()=>censusRecords('HTML403','city','url','now'));
});
test('403 is not retried; transient failures have a two-attempt limit',async()=>{
 let calls=0;await assert.rejects(boundedFetch('https://example.test',async()=>{calls++;return new Response('',{status:403});}));assert.equal(calls,1);
 calls=0;await assert.rejects(boundedFetch('https://example.test',async()=>{calls++;return new Response('',{status:500});}));assert.equal(calls,2);
});
test('published model version matches calculation code; population scope refs exist',async()=>{
 const model=JSON.parse(await readFile('public/data/market-model.json','utf8')),stats=JSON.parse(await readFile('public/data/statistics.json','utf8'));
 assert.equal(model.version,MODEL_VERSION);assert.ok(stats.profiles.every(p=>stats.populations.some(r=>r.scopeId===p.cityScopeId)));
 assert.ok(stats.populations.every(p=>p.asOf&&p.firstCollectedAt&&p.sourceUrl.startsWith('https://')));
});

test('failed population collection preserves the last good saved statistics',async()=>{
 const before=await readFile('public/data/statistics.json','utf8');
 const result=spawnSync(process.execPath,['scripts/collect-statistics.mjs','--simulate-failure','--force','--dry-run'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/census-city: failed/);assert.match(result.stdout,/census-metro: failed/);
 assert.equal(await readFile('public/data/statistics.json','utf8'),before);
});
