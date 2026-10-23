import {createHash} from 'node:crypto';
import {textFromHtml} from './collector-lib.mjs';
import {kstDay} from '../src/domain.mjs';
export const STATUS_LABELS={success_baseline:'조회 성공·최초 기준 저장',success_changed:'조회 성공·새 변경 있음',success_unchanged:'조회 성공·새 변경 없음',count_not_public:'차량 수 비공개',access_failed:'접근 실패',extraction_failed:'추출 실패',unconnected:'자동 수집 미연결',unresearched:'아직 조사하지 않음'};
export async function monitorDocument(config,prior,{fetcher=fetch,now=new Date().toISOString(),forceFailure=false}={}){
 const record={...config,...prior,code:config.code,name:config.name,agency:config.agency,url:config.url,information:config.information,reason:config.reason,researchStatus:config.researchStatus,countDisclosure:config.countDisclosure,automatic:config.researchStatus==='reviewed',referenceDate:prior?.referenceDate??null,changed:null};
 if(prior&&prior.url!==config.url){record.previousSource={url:prior.url,lastSuccessAt:prior.lastSuccessAt,contentHash:prior.contentHash,referenceDate:prior.referenceDate};delete record.contentHash;record.lastSuccessAt=null;record.referenceDate=null;}
 if(config.researchStatus!=='reviewed')return {...record,status:config.researchStatus==='authority_only'?'unconnected':'unresearched',message:'관할 기관만 확인했으며 AV 자료 자동 점검은 미연결. 조회 성공으로 집계하지 않음.'};
 const started=Date.now();record.lastCheckedAt=now;record.attempts=0;
 try{
  let response,error;for(let attempt=0;attempt<2;attempt++){record.attempts++;try{if(forceFailure)throw Error('수집 실패 모의');response=await fetcher(config.url,{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'RobotaxiAtlas/2.0 (+https://github.com/jaehun242/robotaxi-atlas)'}});if(!response.ok)throw Object.assign(Error(`HTTP ${response.status}`),{noRetry:[401,403,404].includes(response.status)});error=null;break;}catch(e){error=e;if(e.noRetry||forceFailure)break;}}
  if(error)throw error;
  if(Number(response.headers.get('content-length'))>12000000){await response.body?.cancel();throw Object.assign(Error('문서 용량 제한 초과 · 다운로드 생략'),{extraction:true});}
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>12000000)throw Object.assign(Error('문서 용량 제한 초과'),{extraction:true});chunks.push(chunk);}const bytes=Buffer.concat(chunks);
  const pdf=bytes.subarray(0,4).toString()==='%PDF';let body;
  if(pdf){body=bytes;record.contentType='PDF 문서 해시 · 본문 의미/수치 추출 미연결';}
  else {const raw=bytes.toString('utf8');body=textFromHtml(raw);
   if(/access denied|request rejected|page not served|verify you are human|just a moment|enable javascript and cookies|security verification/i.test(body)||/<title>\s*Loading[.\s]*<\/title>/i.test(raw)||body.length<120)throw Object.assign(Error('접근 차단·렌더링 전용·불완전 문서'),{extraction:true});
   if(!/autonom|automat|self.driv|connected.{0,50}vehicle|\bCAV\b|platoon|driverless|자율주행/i.test(body))throw Object.assign(Error('AV 관련 본문 추출 확인 실패'),{extraction:true});
   if(/\.pdf(?:$|\?)/i.test(config.url))throw Object.assign(Error('PDF URL이 PDF를 반환하지 않음'),{extraction:true});
   record.contentType='HTML 문서 변경 감지 · 차량 수 추출 미연결';
  }
  const priorHash=prior?.url===config.url?prior?.contentHash:null;
  const hash=createHash('sha256').update(body).digest('hex');record.changed=priorHash?hash!==priorHash:null;record.contentHash=hash;record.lastSuccessAt=now;
  record.status=!priorHash?'success_baseline':record.changed?'success_changed':'success_unchanged';
  record.message=record.changed===null?'공식 문서 최초 기준 저장. 과거 대비 변경 여부는 미확정.':record.changed?'등록한 문서 내용 변경 감지. Tesla 관련 의미는 원문 재검토 필요.':'등록한 문서 내용 변경 없음. 주 전체에 신규 발표가 없다는 뜻은 아님.';
  record.quantityStatus=config.countDisclosure==='not_disclosed'?'count_not_public':'not_extracted';
 }catch(e){record.status=e.extraction?'extraction_failed':'access_failed';record.message=e.message+' · 마지막 정상 문서 해시·원본 기준일 유지.';}
 record.durationMs=Date.now()-started;return record;
}
export function coverageSummary(records,now=new Date().toISOString()){
 const today=kstDay(now),fresh=records.filter(r=>r.lastCheckedAt&&kstDay(r.lastCheckedAt)===today),success=fresh.filter(r=>r.status.startsWith('success_')||r.status==='count_not_public');
 return {jurisdictions:records.length,checkedToday:fresh.length,success:success.length,accessFailed:fresh.filter(r=>r.status==='access_failed').length,extractionFailed:fresh.filter(r=>r.status==='extraction_failed').length,unconnected:records.filter(r=>r.status==='unconnected').length,unresearched:records.filter(r=>r.status==='unresearched').length,countNotPublic:success.filter(r=>r.quantityStatus==='count_not_public').length,numericParsers:records.filter(r=>r.numericParserConnected).length};
}
