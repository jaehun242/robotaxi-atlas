const checks={atlas:d=>Array.isArray(d?.observations)&&Array.isArray(d?.cities),statistics:d=>Array.isArray(d?.populations),scenarios:d=>d?.defaults&&typeof d.defaults==='object',monitoring:d=>Array.isArray(d?.registries)&&Array.isArray(d?.jurisdictions)};
export async function refreshPublishedData(previous={}, {baseUrl='/',fetcher=fetch,now=Date.now()}={}){
 const keys=Object.keys(checks),data={...previous},failed=[];
 const results=await Promise.allSettled(keys.map(async key=>{
  const response=await fetcher(`${baseUrl}data/${key}.json?at=${now}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('HTTP '+response.status);const value=await response.json();
  if(!checks[key](value))throw Error('게시 자료 형식 변경');return value;
 }));
 results.forEach((result,i)=>{if(result.status==='fulfilled')data[keys[i]]=result.value;else failed.push(keys[i]);});
 return {data,failed};
}
