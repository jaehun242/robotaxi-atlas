import {readFile,writeFile,rename} from 'node:fs/promises';
import {US_GEOGRAPHIES,boundedFetch,censusRecords,mergeStatistics} from './statistics-lib.mjs';
const now=new Date().toISOString();
let data;try{data=JSON.parse(await readFile('public/data/statistics.json','utf8'));}catch{data={version:1,updatedAt:now,lastAttemptAt:null,populations:[],profiles:[],demands:[],checks:[],revisions:[]};}
if(data.lastAttemptAt&&Date.now()-Date.parse(data.lastAttemptAt)<7*86400000&&!process.argv.includes('--force')&&process.env.FORCE_STATISTICS!=='true'){console.log('통계: 최근 7일 안에 확인함. 원래 기준일·최초 수집일 보존.');process.exit(0);}
const dry=process.argv.includes('--dry-run');
const fetchOfficial=async url=>{
  if(process.argv.includes('--simulate-failure'))throw Error('수집 실패 모의 검증');
  return boundedFetch(url);
};
for(const kind of ['city','metro']){
  const portal=`https://www.census.gov/data/tables/time-series/demo/popest/2020s-total-${kind==='city'?'cities-and-towns':'metro-and-micro-statistical-areas'}.html`;
  let url=kind==='city'?'https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/cities/totals/sub-est2025.csv':'https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/metro/totals/cbsa-est2025-alldata.csv';
  let discovery='';
  try{const html=await(await fetchOfficial(portal)).text();const pattern=kind==='city'?/https:\/\/www2\.census\.gov\/programs-surveys\/popest\/datasets\/[^"\s<>]+\/sub-est(20\d{2})\.csv/gi:/https:\/\/www2\.census\.gov\/programs-surveys\/popest\/datasets\/[^"\s<>]+\/cbsa-est(20\d{2})-alldata\.csv/gi;const matches=[...html.matchAll(pattern)].sort((a,b)=>Number(b[1])-Number(a[1]));if(matches.length)url=matches[0][0];else discovery='새 빈티지 링크 미확인; 마지막 확인된 공식 CSV 사용. ';}catch(e){discovery=`발표 목록 ${e.message}; 마지막 확인된 공식 CSV 사용. `;}
  let check;
  try{const response=await fetchOfficial(url);const bytes=await response.arrayBuffer();if(bytes.byteLength>20000000)throw Error('CSV 크기 제한 초과');const text=new TextDecoder('windows-1252').decode(bytes);const records=censusRecords(text,kind,url,now);data=mergeStatistics(data,records,now);check={sourceId:`census-${kind}`,checkedAt:now,state:'ok',url,message:`${discovery}${records.length}개 ${kind==='city'?'도시':'MSA'} 통계 확인. 값·빈티지가 같으면 통계 날짜를 갱신하지 않음.`};}catch(e){check={sourceId:`census-${kind}`,checkedAt:now,state:'failed',url,message:`${discovery}${e.message}. 마지막 정상 통계 보존.`};}
  data.checks=data.checks.filter(c=>c.sourceId!==check.sourceId);data.checks.push(check);console.log(check.sourceId+': '+check.state+' — '+check.message);
}
const manual=JSON.parse(await readFile('data/statistics-manual.json','utf8'));
data=mergeStatistics(data,manual.populations.map(p=>({...p,firstCollectedAt:now,changedAt:now})),now);
for(const demand of manual.demands){
  const index=data.demands.findIndex(d=>d.id===demand.id),prior=data.demands[index];
  if(!prior){data.demands.push({...demand,firstCollectedAt:now,changedAt:now});data.updatedAt=now;continue;}
  const stable=o=>JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k])=>!['firstCollectedAt','changedAt'].includes(k)).sort(([a],[b])=>a.localeCompare(b))));
  if(stable(prior)!==stable(demand)){const replacement={...demand,firstCollectedAt:prior.firstCollectedAt,changedAt:now};data.revisions.push({kind:'traffic_statistic',changedAt:now,previous:prior,replacement});data.demands[index]=replacement;data.updatedAt=now;}
}
data.profiles=[...US_GEOGRAPHIES.map(g=>({city:g.city,cityScopeId:`us:place:${g.state}${g.place}`,metroScopeId:`us:cbsa:${g.cbsa}`,note:'도시와 MSA를 별도로 표시. 서비스 구역 인구는 미확인.',trafficNote:g.city==='san-francisco'?'SFCTA 2016년 TNC 평일 기록은 현재 수요 기본값으로 부적절하며 최신 전체 수요 미확보.':'현재 도시 전체 택시·호출차 일일 수요를 검증하지 못함. 인구 비율 기본값 없음.'})),{city:'london',cityScopeId:'uk:region:E12000007',metroScopeId:null,note:'행정구역은 Greater London. 별도 광역권 인구 미확보.',trafficNote:'TfL 2024 사람 이동 자료를 참고자료로 제공. 차량 건수로 환산할 동승 인원 가정 필요.'},{city:'seoul',cityScopeId:'kr:admin:11',metroScopeId:null,note:'2026년 2분기 최신 검증 수치. 더 최신인 8월 발표의 수치는 추출 대기.',latestNotice:'https://data.seoul.go.kr/dataService/statView.do?pageIndex=1&wjId=c3781c51238afda889813e9dd8b3a140',trafficNote:'등록 택시 실적의 지역 범위가 행정시 수요와 일치하는지 미확인.'}];
data.lastAttemptAt=now;
if(!dry){await writeFile('public/data/statistics.json.tmp',JSON.stringify(data,null,2)+'\n');await rename('public/data/statistics.json.tmp','public/data/statistics.json');}
console.log(`통계 ${data.populations.length}개 · 교통 참고 ${data.demands.length}개 · ${dry?'파일 미변경':'저장'}`);
