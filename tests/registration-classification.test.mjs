import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeVehicles,preserveRegistration,collectTexasRegistrations,applyRegistrationStatus} from '../scripts/registration-lib.mjs';
const before='2026-11-04T22:40:54.238Z',now='2026-11-05T20:42:50.336Z';
const vin=i=>'5YJ'+String(i).padStart(14,'0');
const good=()=>preserveRegistration(null,{id:'tx-tesla-official',region:'TX',sourceUrl:'https://official.test/registry',total:1244,cybercab:573,model_y:631,unknown:40,contentHash:'classified'},before);
const privateBody={operators:[{slug:'tesla-robotaxi-llc',fleet_size:1244,models:{Cybercab:573,'Model Y':631,'Unclassified':40},last_synced_at:before}]};
const missingModelFetcher=async url=>{
 if(!String(url).includes('txmccs'))return Response.json(privateBody);
 const offset=Number(new URL(url).searchParams.get('offset'));
 return Response.json({total:1244,vehicles:Array.from({length:Math.min(100,1244-offset)},(_,i)=>({vin:vin(offset+i)}))});
};
test('a VIN-only response cannot overwrite classified values or append a false zero graph point',async()=>{
 const old=good(),registries=await collectTexasRegistrations([old],{fetcher:missingModelFetcher,now});
 const official=registries[0];
 assert.equal(official.checkState,'failed');
 assert.match(official.error,/차종.*0대/s);
 for(const key of ['total','cybercab','model_y','unknown','asOf','firstCollectedAt','lastSuccessAt','contentHash'])assert.equal(official[key],old[key],key);
 assert.equal(official.lastCheckedAt,now);
 const atlas={lastAttemptAt:before,services:[{observedAt:before}],sourceRuns:[],sources:[{id:'tx-dmv'}]},monitoring={lastAttemptAt:before,jurisdictions:[{code:'TX',lastCheckedAt:before}],registrationHistory:[]};
 applyRegistrationStatus(atlas,monitoring,[old],before);
 const previousHistory=structuredClone(monitoring.registrationHistory);
 applyRegistrationStatus(atlas,monitoring,registries,now);
 assert.deepEqual(monitoring.registrationHistory,previousHistory);
 assert.equal(atlas.sourceRuns.find(r=>r.sourceId==='tx-dmv').state,'failed');
 assert.equal(atlas.lastAttemptAt,before);assert.equal(atlas.services[0].observedAt,before);
 assert.equal(monitoring.jurisdictions[0].numericReferenceDate,old.asOf);
 assert.ok(!JSON.stringify(official).includes(vin(0)));
});
test('an initial incomplete classification is unknown rather than an exact model zero',async()=>{
 const registries=await collectTexasRegistrations([],{fetcher:missingModelFetcher,now});
 assert.equal(registries[0].checkState,'failed');
 assert.equal(registries[0].cybercab,null);assert.equal(registries[0].model_y,null);assert.equal(registries[0].asOf,null);
 assert.throws(()=>summarizeVehicles([{vin:vin(1),model:'Model Y'},{vin:vin(2)}],2),/차종.*0대/s);
 assert.throws(()=>preserveRegistration(null,{total:1244,cybercab:0,model_y:0,unknown:1244,contentHash:'none'},now),/차종.*0대/s);
});
test('fully classified single-model and genuinely empty registries retain exact zero values',()=>{
 const onlyY=summarizeVehicles([{vin:vin(1),model:'Model Y'},{vin:vin(2),model:'model_y'}],2);
 assert.equal(onlyY.cybercab,0);assert.equal(onlyY.model_y,2);assert.equal(onlyY.unknown,0);
 const registry=preserveRegistration(null,{id:'tx-tesla-official',...onlyY},now);
 assert.equal(registry.checkState,'ok');assert.equal(registry.cybercab,0);
 const empty=summarizeVehicles([],0);assert.equal(empty.total,0);assert.equal(empty.cybercab,0);assert.equal(empty.model_y,0);
 assert.equal(preserveRegistration(registry,{id:'tx-tesla-official',...empty},now).cybercab,0);
});
test('partial positive classifications are preserved, while an incomplete private partition cannot reset a model to zero',()=>{
 const old=good();
 const same=preserveRegistration(old,{...old,contentHash:'classified'},now);
 assert.equal(same.asOf,before);assert.equal(same.lastCheckedAt,now);
 assert.throws(()=>preserveRegistration(old,{total:1244,cybercab:573,model_y:0,unknown:671,contentHash:'lost-y'},now),/차종.*0대/s);
 assert.equal(old.cybercab,573);assert.equal(old.model_y,631);
});

test('both official and private label collapses keep their own last-good values and dates',async()=>{
 const official=good(),privateRegistry={...good(),id:'tx-tesla-fsddb',verification:'unofficial',sourceUrl:'https://private.test/registry'};
 const rows=await collectTexasRegistrations([official,privateRegistry],{now,fetcher:async url=>String(url).includes('txmccs')?missingModelFetcher(url):Response.json({operators:[{slug:'tesla-robotaxi-llc',fleet_size:1244,models:{'Unknown model':1244},last_synced_at:now}]})});
 for(const [index,prior] of [official,privateRegistry].entries()){
  assert.equal(rows[index].checkState,'failed');assert.match(rows[index].error,/차종.*0대/s);
  for(const key of ['total','cybercab','model_y','unknown','asOf','lastSuccessAt','firstCollectedAt'])assert.equal(rows[index][key],prior[key],key);
  assert.equal(rows[index].lastCheckedAt,now);
 }
});
