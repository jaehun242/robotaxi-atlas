export const US_GEOGRAPHIES=[
  {city:'austin',state:'48',place:'05000',cbsa:'12420'},
  {city:'dallas',state:'48',place:'19000',cbsa:'19100'},
  {city:'houston',state:'48',place:'35000',cbsa:'26420'},
  {city:'miami',state:'12',place:'45000',cbsa:'33100'},
  {city:'orlando',state:'12',place:'53000',cbsa:'36740'},
  {city:'tampa',state:'12',place:'71000',cbsa:'45300'},
  {city:'san-francisco',state:'06',place:'67000',cbsa:'41860'},
  {city:'phoenix',state:'04',place:'55000',cbsa:'38060'},
  {city:'las-vegas',state:'32',place:'40000',cbsa:'29820'},
  {city:'jacksonville',state:'12',place:'35000',cbsa:'27260'},
  {city:'san-antonio',state:'48',place:'65000',cbsa:'41700'}
];
export function parseTable(text){
  const rows=[];let row=[],cell='',quoted=false;text=text.replace(/^\ufeff/,'');
  for(let i=0;i<=text.length;i++){const c=text[i]??'\n';if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('불완전한 CSV 인용부호');const [headers,...records]=rows;if(!headers?.includes('POPESTIMATE2025')&&!headers?.some(h=>/^POPESTIMATE20\d{2}$/.test(h)))throw Error('Census 인구 열을 찾지 못했습니다.');
  return records.map(values=>Object.fromEntries(headers.map((h,i)=>[h.trim(),values[i]?.trim()??''])));
}
export function censusRecords(text,kind,url,now){
  const rows=parseTable(text),years=Object.keys(rows[0]??{}).filter(k=>/^POPESTIMATE20\d{2}$/.test(k)).map(k=>Number(k.slice(-4)));const year=Math.max(...years);if(!Number.isFinite(year))throw Error('통계 기준연도 없음');
  return US_GEOGRAPHIES.map(g=>{
    const row=kind==='city'?rows.find(r=>r.SUMLEV==='162'&&r.STATE===g.state&&r.PLACE===g.place):rows.find(r=>r.CBSA===g.cbsa&&!r.MDIV&&!r.STCOU&&r.LSAD==='Metropolitan Statistical Area');
    const value=Number(row?.[`POPESTIMATE${year}`]);if(!row||!Number.isSafeInteger(value)||value<=0)throw Error(`${g.city}의 ${kind} 인구·범위 검증 실패`);
    const scopeId=kind==='city'?`us:place:${g.state}${g.place}`:`us:cbsa:${g.cbsa}`;
    return {id:scopeId,scopeId,kind,name:row.NAME+(kind==='city'?`, ${row.STNAME}`:''),value,asOf:`${year}-07-01`,publishedAt:year===2025?(kind==='city'?'2026-05-14':'2026-03-26'):null,vintage:`Census Vintage ${year}`,sourceUrl:url,publisher:'U.S. Census Bureau',firstCollectedAt:now,changedAt:now,note:kind==='city'?'법정 도시 경계의 추계 인구. 광역권과 합산하지 않음.':'MSA 전체 인구. 중심 도시만의 인구와 다름. 같은 MSA는 한 번만 집계.'};
  });
}
export function mergeStatistics(existing,records,now){
  const data=structuredClone(existing);let changed=false;
  for(const record of records){
    const i=data.populations.findIndex(p=>p.id===record.id);
    if(i<0){data.populations.push(record);changed=true;continue;}
    const prior=data.populations[i];
    const stable=o=>JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k])=>!['firstCollectedAt','changedAt'].includes(k)).sort(([a],[b])=>a.localeCompare(b))));
    if(stable(prior)===stable(record))continue;
    if(record.asOf<prior.asOf)continue;
    const replacement={...record,firstCollectedAt:prior.firstCollectedAt,changedAt:now};
    data.revisions.push({kind:'population_statistic',changedAt:now,previous:prior,replacement});data.populations[i]=replacement;changed=true;
  }
  if(changed)data.updatedAt=now;return data;
}
export async function boundedFetch(url,fetcher=fetch){
  let error;
  for(let attempt=0;attempt<2;attempt++)try{const r=await fetcher(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'RobotaxiAtlas/1.0 (+https://github.com/jaehun242/robotaxi-atlas)'}});if(!r.ok){if([403,404,401].includes(r.status))throw Object.assign(Error(`HTTP ${r.status}`),{noRetry:true});throw Error(`HTTP ${r.status}`);}return r;}catch(e){error=e;if(e.noRetry)break;}
  throw error;
}
