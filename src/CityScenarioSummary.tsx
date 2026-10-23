import type {ScenarioDataset} from './market-types';
import {calculateMarket} from './market.mjs';
import {approx} from './estimates';
export default function CityScenarioSummary({city,scenarios,onOpen}:{city:string;scenarios:ScenarioDataset|null;onOpen:()=>void}){
 const defaults=scenarios?.defaults[city];if(!defaults)return null;const calc=calculateMarket(defaults.current);
 return <section className="city-scenario-summary"><h3>현재 수요 · 분석 기본 시나리오</h3><p>전체 시장 A / Tesla B · 보유 차량 · 반올림</p>{calc.results.map(r=><div key={r.name}><span>{r.name}</span><b>A {approx(r.marketFleet)} / B {approx(r.teslaFleet)}대</b></div>)}<small>공식 통계·대체 자료 + 분석 가정. Tesla 배치 계획이 아닙니다.</small><button onClick={onOpen}>2030·가정 수정·계산 근거 보기 ↗</button></section>;
}
