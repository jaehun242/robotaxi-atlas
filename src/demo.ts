import type {Dataset, Observation} from './types';
export function demoData(real:Dataset):Dataset {
  const now=new Date();const observations:Observation[]=[];
  for(let d=29;d>=0;d--) for(const [i,city] of ['austin','dallas','houston'].entries()) for(const model of ['cybercab','model_y'] as const) for(const basis of ['allocated','deployed','testing','commercial','observed'] as const) {
    const date=new Date(+now-d*86400000);date.setUTCHours(0,0,0,0);
    const factor={allocated:1.3,deployed:1,testing:.13,commercial:.7,observed:1}[basis];
    observations.push({id:`demo-${city}-${model}-${basis}-${d}`,city,model,basis,count:Math.round(((model==='cybercab'?120:180)+(29-d)*(model==='cybercab'?4:2)-i*40)*factor),asOf:date.toISOString(),collectedAt:date.toISOString(),sourceId:'demo',sourceUrl:'https://example.com/demo',scope:'데모 · 고정된 가상 집계 범위',verification:'official_single',note:'화면 동작 검사용 가상 수치. 실제 차량 정보가 아닙니다.'});
  }
  const demo=structuredClone(real);demo.observations=observations;demo.sources=[...real.sources,{id:'demo',name:'DEMO · 가상 데이터',url:'https://example.com/demo',priority:0,access:'가상',definition:'실제 데이터 아님',automation:'브라우저에서만 생성'}];
  demo.services=demo.services.map(s=>s.city==='dallas'&&s.model==='model_y'?{...s,status:'commercial'}:s);
  demo.services.push({id:'demo-dallas-cybercab',city:'dallas',model:'cybercab',status:'testing',safety:'yes',paid:false,asOf:now.toISOString(),observedAt:now.toISOString(),sourceId:'demo',sourceUrl:'https://example.com/demo',verification:'official_single',note:'DEMO · 시험운행과 상업운행 구분을 확인하는 가상 상태'});
  return demo;
}
