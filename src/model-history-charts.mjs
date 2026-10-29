import {officialTimeline} from './registration-charts.mjs';
export function historicalModelSources(reviewed,automated=[],history=[]){
 const manual=(reviewed?.sources??[]).map(s=>({...s,observations:(reviewed.observations??[]).filter(o=>o.sourceId===s.id),sourceId:s.id}));
 const direct={sourceId:'tx-official',name:'TxDMV 직접 확인',url:'https://txmccs.txdmv.gov/truckstop/companies/81edcff1-8a6e-4ed0-be1f-60668515e223/automated-motor-vehicles',verification:'official_single',dateBasis:'KST_confirmation_day',scope:'US-TX',basis:'registered',observations:officialTimeline(history).filter(r=>r.checkedAt).map(r=>({id:r.id,sourceId:'tx-official',date:r.day,cybercab:r.cybercab,model_y:r.model_y,total:r.total,observedAt:r.lastCheckedAt??r.checkedAt,firstCollectedAt:r.checkedAt,note:'한국 날짜별 마지막 직접 확인. 실제 신규 등록일과 다름.'}))};
 return [...manual,...automated,direct].filter(s=>(s.observations??[]).length);
}
export function modelSeries(sources,{period='all',end=new Date().toISOString().slice(0,10),verifiedOnly=false,model='',view='count'}={}){
 const start=period==='all'?'2026-06-09':new Date(Date.parse(end+'T00:00:00Z')-(Number(period)-1)*86400000).toISOString().slice(0,10);
 const days=[];for(let t=Date.parse(start+'T00:00:00Z');t<=Date.parse(end+'T00:00:00Z');t+=86400000)days.push(new Date(t).toISOString().slice(0,10));
 const models=model?[model]:['cybercab','model_y'];
 return sources.filter(s=>!verifiedOnly||s.verification==='official_single').flatMap(source=>{
  const byDay=new Map((source.observations??[]).map(o=>[o.date,o]));
  return models.map(model=>({source,model,rows:days.map(day=>{const observation=byDay.get(day),count=observation?.[model]??null,previous=byDay.get(new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10)),before=previous?.[model]??null;
   return {day,observation:observation??null,value:view==='count'?count:count!==null&&before!==null?count-before:null};
  })}));
 });
}
export function modelConflicts(sources){
 const days=new Map();for(const s of sources)for(const o of s.observations??[]){const list=days.get(o.date)??[];list.push({...o,sourceName:s.name});days.set(o.date,list);}
 return [...days].filter(([,obs])=>['cybercab','model_y'].some(model=>new Set(obs.map(o=>o[model]).filter(v=>v!==null&&v!==undefined)).size>1)).map(([date,observations])=>({date,observations}));
}
