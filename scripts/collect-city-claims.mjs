import{readFile,writeFile,rename}from'node:fs/promises';
import{collectCityClaims}from'./city-claims-lib.mjs';
const now=new Date().toISOString(),dry=process.argv.includes('--dry-run');
const result=await collectCityClaims(JSON.parse(await readFile('public/data/atlas.json','utf8')),{now,forceFailure:process.argv.includes('--simulate-failure')});
if(!dry){await writeFile('public/data/atlas.json.tmp',JSON.stringify(result,null,2)+'\n');await rename('public/data/atlas.json.tmp','public/data/atlas.json');}
const r=result.cityFleetClaims.find(c=>c.sourceId==='mycybercab-austin');
console.log(JSON.stringify({source:r.sourceId,state:r.checkState,count:r.count,qualifier:r.countQualifier,asOf:r.asOf,fetchedAt:r.fetchedAt,dry}));
