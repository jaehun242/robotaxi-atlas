import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {blankMarket,calculateMarket,illustration} from '../src/market.mjs';
const fixture=()=>({...illustration(blankMarket('test','scope')),referenceDate:'2024-12-31',pricingMode:'fare',referenceFare:'2',elasticity:'0.6',scenarios:[20,50,80].map((conversion,i)=>({conversion:String(conversion),teslaShare:String([10,25,40][i]),marketProductivity:'25',teslaProductivity:'30',inducedDemand:'0',fare:String([2,1.5,1][i])}))});
test('fare reduction changes demand once, keeps share independent, and disallows induced double count',()=>{
 const a=fixture(),r=calculateMarket(a);assert.ok(r.coherent);assert.equal(r.results[0].fareMultiplier,1);assert.equal(r.results[2].fareMultiplier,1.25);assert.equal(r.results[2].paidTrips,r.targetVehicleTrips);assert.ok(Math.abs(r.results[1].teslaPaidTrips/r.results[1].paidTrips-.25)<1e-12);
 const lower=structuredClone(a);lower.scenarios[1].fare='1';const b=calculateMarket(lower);assert.ok(b.results[1].teslaFleet>r.results[1].teslaFleet);assert.equal(lower.scenarios[1].teslaShare,a.scenarios[1].teslaShare);
 const duplicate=structuredClone(a);duplicate.scenarios[1].inducedDemand='10';assert.ok(!calculateMarket(duplicate).coherent);
 const zero=structuredClone(a);zero.elasticity='0';assert.ok(calculateMarket(zero).results.every(r=>r.fareMultiplier===1));
 for(const price of ['0','','-1']){const bad=fixture();bad.scenarios[1].fare=price;assert.ok(!calculateMarket(bad).coherent);}
});
test('metro proxy retains geography/household assumptions and every scenario remains coherent',async()=>{
 const d=JSON.parse(await readFile('public/data/scenarios.json','utf8'));
 for(const city of ['austin','houston','miami','orlando','tampa','dallas']){const row=d.defaults[city];assert.ok(row.metroEvidence.kind==='proxy');assert.ok(row.metroCurrent.scopeId.startsWith('us:msa-resident-proxy:'));assert.equal(row.current.sourceIncludesExternal,false);for(const input of [row.current,row.future,row.metroCurrent,row.metroFuture])assert.ok(calculateMarket(input).coherent,city);assert.ok(Number(row.metroCurrent.replacement)>Number(row.current.replacement));}
 assert.equal(d.contexts.houston.visitor.annualVisits,90100000);assert.equal(d.contexts.miami.driver.count,null);assert.equal(d.contexts.dallas.visitor.annualVisits,27700000);
 assert.ok(Object.values(d.contexts).every(c=>c.visitor===null||c.visitor.year<2026));
});
