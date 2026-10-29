import test from 'node:test';
import assert from 'node:assert/strict';
import {preferredCityClaim,formatClaimCount} from '../src/preferred-city-claim.mjs';
import {aggregate,latest} from '../src/domain.mjs';
const filters={country:'US',region:'',city:'',model:'',basis:'observed',status:'',verification:'credible'};
const claim={sourceId:'mycybercab-austin',city:'austin',model:'cybercab',basis:'reported_fleet',count:573,countQualifier:'at_least',verification:'unofficial',sourceUrl:'https://mycybercab.com/live',asOf:'2026-10-27',sourceAsOf:'2026-10-27',datePrecision:'day',lastSuccessAt:'2026-10-29T08:00:00Z'};
function fixture(){
 return {cities:[{id:'austin',country:'US',region:'TX'},{id:'dallas',country:'US',region:'TX'}],sources:[],services:[],cityFleetClaims:[structuredClone(claim)],observations:[{id:'cc',city:'austin',model:'cybercab',basis:'observed',count:229,asOf:'2026-10-28T23:07:00Z',scope:'Austin community roster',verification:'unofficial'},{id:'y',city:'austin',model:'model_y',basis:'observed',count:236,asOf:'2026-10-28T23:07:00Z',scope:'Austin community roster',verification:'unofficial'}]};
}
test('selected publisher reference retains its plus qualifier, unofficial grade and original source date',()=>{
 const data=fixture(),before=structuredClone(data),selected=preferredCityClaim(data,filters,'austin','cybercab');
 assert.equal(formatClaimCount(selected),'573+');assert.equal(selected.verification,'unofficial');assert.equal(selected.sourceAsOf,'2026-10-27');assert.equal(selected.basis,'reported_fleet');
 assert.deepEqual(data,before);
});
test('reference never replaces or sums with city observations, Texas registrations or market fleet rows',()=>{
 const data=fixture(),before=structuredClone(data);preferredCityClaim(data,filters,'austin','cybercab');
 const rows=latest(data,filters);assert.equal(rows.find(r=>r.model==='cybercab').count,229);assert.equal(aggregate(rows).total,465);
 assert.deepEqual(data,before);assert.equal(data.observations.some(o=>o.count===573),false);
});
test('official-only, other basis, city, region, country or model filters hide the claim',()=>{
 const data=fixture();
 for(const patch of [{verification:'verified'},{verification:'unverified'},{basis:'deployed'},{basis:'allocated'},{basis:'commercial'},{basis:'testing'},{city:'dallas'},{region:'FL'},{country:'GB'},{model:'model_y'}])assert.equal(preferredCityClaim(data,{...filters,...patch},'austin','cybercab'),null);
 assert.equal(preferredCityClaim(data,filters,'dallas','cybercab'),null);
 assert.equal(preferredCityClaim(data,filters,'austin','model_y'),null);
 assert.equal(preferredCityClaim(data,{...filters,verification:'all'},'austin','cybercab').count,573);
});
test('real publisher claim cannot leak into generated demo data',()=>{
 const data=fixture();data.sources.push({id:'demo'});assert.equal(preferredCityClaim(data,filters,'austin','cybercab'),null);
 const explicit=fixture();explicit.demo=true;assert.equal(preferredCityClaim(explicit,filters,'austin','cybercab'),null);
});
test('unsupported counts, qualifiers and security or verification changes are not presented as selected publisher claims',()=>{
 for(const patch of [{count:-1},{count:573.5},{count:null},{countQualifier:'approx'},{verification:'official_single'},{verification:'unverified'},{basis:'registered'},{sourceId:'other-site'},{sourceUrl:'javascript:alert(1)'}]){
  const data=fixture();Object.assign(data.cityFleetClaims[0],patch);assert.equal(preferredCityClaim(data,filters,'austin','cybercab'),null);
 }
 assert.equal(formatClaimCount({count:573,countQualifier:'exact'}),'573');assert.equal(formatClaimCount({count:null,countQualifier:'at_least'}),'—');
});
test('duplicate same-date references resolve by newer actual check, never by greatest count, and indistinguishable conflicts stay absent',()=>{
 const data=fixture();data.cityFleetClaims.push({...claim,count:800,lastSuccessAt:'2026-10-29T07:00:00Z'});
 assert.equal(preferredCityClaim(data,filters,'austin','cybercab').count,573);
 data.cityFleetClaims.push({...claim,count:800});assert.equal(preferredCityClaim(data,filters,'austin','cybercab'),null);
});
test('failed latest check retains an existing original-dated reference instead of producing a new count',()=>{
 const data=fixture();Object.assign(data.cityFleetClaims[0],{checkState:'failed',lastAttemptAt:'2026-10-30T00:00:00Z'});
 const selected=preferredCityClaim(data,filters,'austin','cybercab');assert.equal(selected.count,573);assert.equal(selected.sourceAsOf,'2026-10-27');assert.equal(selected.lastSuccessAt,'2026-10-29T08:00:00Z');
});
