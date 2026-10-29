import type {ScenarioDataset} from './market-types';
import {calculateMarket} from './market.mjs';
import {approx} from './estimates';
export default function CityScenarioSummary({city,scenarios,onOpen}:{city:string;scenarios:ScenarioDataset|null;onOpen:()=>void}){
 const defaults=scenarios?.defaults[city];if(!defaults)return null;const calc=calculateMarket(defaults.metroCurrent??defaults.current);
 return <section className="city-scenario-summary"><h3>광역권 수요 · 분석 시나리오</h3><p>전체 시장 A / Tesla B · 거주 수요 대체 추정</p>{calc.results.map(r=><div key={r.name}><span>{r.name}</span><b>A {approx(r.marketFleet)} / B {approx(r.teslaFleet)}대</b></div>)}<small>관광 별도 · 전체 광역권 분석이며 현재 서비스 구역과 다릅니다.</small><button onClick={onOpen}>2030·가정 수정·계산 근거 보기 ↗</button></section>;
}
