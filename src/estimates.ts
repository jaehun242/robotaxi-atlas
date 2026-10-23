// Scenario results are uncertain; keep exact arithmetic in JSON and round display
// to two significant digits. Observed/registered vehicle counts are never rounded.
export const roundEstimate=(n:number)=>n===0?0:Number(n.toPrecision(2));
export const approx=(n:number|null)=>n===null?'계산 불가':'약 '+roundEstimate(n).toLocaleString('ko-KR');
