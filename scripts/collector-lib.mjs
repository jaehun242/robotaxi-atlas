import { createHash } from 'node:crypto';
import { ingest, nextUpdate, kstDay,findConflicts } from '../src/domain.mjs';
export const textFromHtml=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
export const hash=body=>createHash('sha256').update(body).digest('hex');
export function extractServices(sourceId,html,cities,now){
  const text=textFromHtml(html);const facts=[];
  const definitions=sourceId==='tesla-support'?[{model:'unspecified',regex:/Currently,? we provide service in limited areas of ([^.]+)\./i}]:sourceId==='tesla-cybercab'?[{model:'model_y',regex:/Robotaxi is currently operating in ([^.]+?) with Model Y vehicles/i},{model:'cybercab',regex:/Cybercab rides are currently available in limited areas of ([^.]+)\./i}]:[];
  for(const def of definitions){
    const matched=text.match(def.regex);
    if(!matched)throw new Error(`공식 문구 패턴 변경 (${def.model}). 이전 기록 보존, 원문 재검토 필요.`);
    const found=cities.filter(c=>new RegExp(`\\b${c.english.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(matched[1]));
    if(!found.length)throw new Error('기존 도시 사전과 일치하는 서비스 지역 없음. 수동 검토 필요.');
    for(const city of found) facts.push({id:sourceId==='tesla-support'?`tesla-service-${city.id}`:def.model==='cybercab'?`tesla-cybercab-${city.id}`:`tesla-model-y-${city.id}`,city:city.id,model:def.model,status:'limited',safety:'unknown',paid:true,asOf:null,observedAt:now,sourceId,verification:'official_single',note:'공식 지원 문장의 일부 지역 서비스 안내. 게시일·안전요원 여부·차량 대수 미공개.'});
  }
  return facts;
}
export async function collectDataset(data,{fetcher=fetch,now=new Date().toISOString(),manual=[],forceFailure=false,retries=3,scopeCountry=null}={}){
  let next=ingest(data,manual,now);let successes=0;
  const automatic=new Set(['tesla-support','tesla-cybercab','tesla-ir-q3','ca-dmv']);
  for(const source of next.sources.filter(s=>automatic.has(s.id))){
    const prior=next.sourceRuns.find(s=>s.sourceId===source.id);let response,body,error;
    for(let attempt=0;attempt<retries;attempt++){
      try{
        if(forceFailure)throw new Error('실패 보존 검증용 강제 실패');
        response=await fetcher(source.url,{headers:{'User-Agent':'RobotaxiAtlas/1.0 (+https://github.com/jaehun242/robotaxi-atlas)','Accept-Language':'en-US,en;q=0.9'},signal:AbortSignal.timeout(25000)});
        if(!response.ok)throw Object.assign(new Error(`HTTP ${response.status}`),{noRetry:[401,403,404].includes(response.status)});
        const isPdf=source.id==='tesla-ir-q3';
        if(isPdf){const bytes=Buffer.from(await response.arrayBuffer());if(bytes.subarray(0,4).toString()!=='%PDF')throw new Error('PDF가 아닌 응답');body=bytes;}
        else {body=await response.text();if(body.length<300||/Access Denied|verify you are human|Just a moment/i.test(body))throw new Error('접근 차단 또는 불완전한 문서');}
        error=null;break;
      }catch(e){error=e;if(e.noRetry)break;if(attempt+1<retries&&!forceFailure)await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
    }
    let run={sourceId:source.id,state:'failed',checkedAt:now,lastSuccessAt:prior?.lastSuccessAt??null,message:error?.message??''};
    if(!error){try{
      const digest=hash(source.id==='tesla-ir-q3'?body:textFromHtml(body));const priorHash=prior?.contentHash;
      if(source.id==='tesla-support'||source.id==='tesla-cybercab'){
        const facts=extractServices(source.id,body,scopeCountry?next.cities.filter(c=>c.country===scopeCountry):next.cities,now);
        for(const fact of facts){fact.sourceUrl=source.url;const i=next.services.findIndex(s=>s.id===fact.id);const old=next.services[i];
          if(i>=0){next.services[i]=old.status===fact.status?{...old,lastCheckedAt:now}:{...old,...fact,lastCheckedAt:now};}
          else next.services.push(fact);
          const unchanged=old&&old.status===fact.status;
          const newsId=`${fact.id}-${hash(`${fact.status}|${fact.model}`).slice(0,10)}`;
          if(!unchanged&&!next.news.some(n=>n.id===newsId))next.news.push({id:newsId,city:fact.city,model:fact.model,title:`${next.cities.find(c=>c.id===fact.city).name} · 공식 서비스 안내 변경 확인`,summary:'공식 지원 페이지의 차종·지역 문구를 확인했습니다. 시작일과 차량 수는 미공개입니다.',eventDate:null,publishedAt:null,firstCollectedAt:now,sourceId:source.id,sourceUrl:source.url});
        }
        const missing=next.services.filter(s=>s.sourceId===source.id&&(!scopeCountry||next.cities.find(c=>c.id===s.city)?.country===scopeCountry)&&!facts.some(f=>f.id===s.id));
        run={...run,state:missing.length?'changed':'ok',message:missing.length?'기존 서비스가 새 문장에 없음. 운영 중단으로 단정하지 않고 이전 상태 보존.':`${facts.length}개 서비스 상태 확인. 도시별 대수 미공개.`};
      }else{
        if(source.id==='ca-dmv'&&!/TESLA\s+ROBOTAXI\s+LLC/i.test(textFromHtml(body)))throw new Error('Tesla 명단 패턴 변경. 허가 상태 수동 검토 필요.');
        const changed=priorHash&&priorHash!==digest;
        run={...run,state:changed?'changed':'ok',message:source.id==='ca-dmv'?changed?'허가 명단 내용 변경 감지 · 원문 검토 필요. 도시별 수치로 변환하지 않음.':'허가 명단 접근 성공. 도시별 대수·서비스로 변환하지 않음.':'공식 PDF 접근 성공. 변경 감지 대상; 수치 추출은 미연결.'};
      }
      run={...run,lastSuccessAt:now,contentHash:digest};successes++;
    }catch(e){run={...run,state:'changed',message:e.message};}}
    const i=next.sourceRuns.findIndex(r=>r.sourceId===source.id);if(i>=0)next.sourceRuns[i]=run;else next.sourceRuns.push(run);
  }
  next.conflicts=findConflicts(next.observations);
  next.lastAttemptAt=now;if(successes)next.lastSuccessAt=now;next.updatedAt=now;next.nextUpdateAt=nextUpdate(now);
  const day=kstDay(now),run={id:`daily-${day}`,startedAt:now,completedAt:now,state:successes===automatic.size?'success':successes?'partial':'failed'};
  const i=next.runs.findIndex(r=>r.id===run.id);if(i>=0)next.runs[i]=run;else next.runs.push(run);
  return next;
}
