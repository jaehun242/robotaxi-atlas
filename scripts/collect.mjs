import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { collectDataset } from './collector-lib.mjs';
import { collectFleet } from './fleet-lib.mjs';
import { collectSafety } from './safety-lib.mjs';
import { parseCSV } from './import-csv.mjs';
import { aggregate,latest,kstDay,nextUpdate } from '../src/domain.mjs';
const data=JSON.parse(await readFile('public/data/atlas.json','utf8'));
const json=JSON.parse((await readFile('data/manual.json','utf8')).replace(/^\ufeff/,''));
const csv=parseCSV(await readFile('data/manual.csv','utf8'));
const now=new Date().toISOString();
const manual=[...new Map([...json,...csv].map(o=>[o.id,{...o,locked:o.locked!==false,collectedAt:o.collectedAt??now}])).values()];
const catalog=JSON.parse(await readFile('data/approved-regions.json','utf8'));
let seeded=data;
if(catalog.regions.some(c=>!data.cities.some(old=>old.id===c.id))&&!process.argv.includes('--simulate-failure')){
  const reviewedHTML='<script type="application/json" data-info="react-data-tesla_robotaxi_graph_1">'+JSON.stringify({data:{comingSoonCities:catalog.regions.map(r=>({t_name:r.discoveryNames[0]}))}})+'</script>';
  seeded=await collectSafety(data,catalog,{now:catalog.reviewedAt,fetcher:async()=>new Response(reviewedHTML)});
  const reviewed=seeded.sourceRuns.find(r=>r.sourceId==='tesla-safety');reviewed.state='reviewed';reviewed.message='원문 HTTP 200 수집본을 사람이 검토한 초기 입력. 확인 날짜 '+catalog.reviewedAt+' 유지. 이후 자동 요청 성공과 별개.';
}
const withPlans=await collectSafety(seeded,catalog,{now,forceFailure:process.argv.includes('--simulate-failure')});
const result=await collectFleet(await collectDataset(withPlans,{manual,now,scopeCountry:'US',forceFailure:process.argv.includes('--simulate-failure')}),{now,forceFailure:process.argv.includes('--simulate-failure')});
const research=JSON.parse(await readFile('data/fleet-research.json','utf8'));
result.fleetResearch=research.cities.map(c=>({...c,checkedAt:research.reviewedAt,sources:research.sources}));
for(const location of catalog.regions)if(result.cities.some(c=>c.id===location.id)&&!result.fleetResearch.some(r=>r.city===location.id))result.fleetResearch.push({city:location.id,checkedAt:catalog.reviewedAt,reason:'공식 Coming Soon 계획을 확인했으나 차종·차량 수·개시일은 미공개. 연결한 도시 명부의 대수도 미확보. 실제 무배치·0대를 뜻하지 않음.',sources:[{name:'Tesla 공식 진출 계획',url:location.evidence.sourceUrl,result:location.evidence.note},{name:'Pioneerlands 공개 도시 명부',url:'https://pioneerlands.org/cybercabtracker',result:'연결한 공개 집계에서 이 지역의 차종별 대수 미확보.'}]});
result.activeScope='US';result.pausedScopes=['GB','KR'];
const completedAt=new Date().toISOString();result.updatedAt=completedAt;result.nextUpdateAt=nextUpdate(completedAt);result.runs.find(r=>r.startedAt===now).completedAt=completedAt;
const dry=process.argv.includes('--dry-run');
if(!dry){
  await writeFile('public/data/atlas.json.tmp',JSON.stringify(result,null,2)+'\n');
  await rename('public/data/atlas.json.tmp','public/data/atlas.json');
  await mkdir('data/snapshots',{recursive:true});
  const summaries=Object.fromEntries(['allocated','deployed','testing','commercial','observed'].map(basis=>[basis,aggregate(latest(result,{country:'US',region:'',city:'',model:'',status:'',verification:basis==='observed'?'credible':'verified',basis}))]));
  await writeFile(`data/snapshots/${kstDay(now)}.json`,JSON.stringify({date:kstDay(now),runAt:now,activeScope:'US',summaries,observations:result.observations,services:result.services,sourceRuns:result.sourceRuns},null,2)+'\n');
}
for(const r of result.sourceRuns)console.log(`${r.sourceId}: ${r.state} — ${r.message}`);
console.log(`Run: ${result.runs.at(-1).state}; observations: ${result.observations.length}; ${dry?'dry-run (no files written)':'saved'}`);
// Partial and total source failure still publish last-good data with a visible failure state.
// Validation errors throw before writing anything, and fail the workflow.
