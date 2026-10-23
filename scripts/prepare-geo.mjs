import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { feature } from 'topojson-client';
// Split rings at the antimeridian so MapLibre does not draw trans-world fill triangles.
function unwrap(ring){let previous=ring[0][0];return ring.map(([raw,y])=>{let x=raw;while(x-previous>180)x-=360;while(x-previous< -180)x+=360;previous=x;return [x,Math.max(-85,Math.min(85,y))];});}
function clip(ring,boundary,keepGreater){let out=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];const insideA=keepGreater?a[0]>=boundary:a[0]<=boundary,insideB=keepGreater?b[0]>=boundary:b[0]<=boundary;if(insideA)out.push(a);if(insideA!==insideB){const t=(boundary-a[0])/(b[0]-a[0]);out.push([boundary,a[1]+t*(b[1]-a[1])]);}}return out;}
function splitGeometry(geometry){const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;const output=[];for(const polygon of polygons){const unwrapped=polygon.map(unwrap);for(const offset of [-360,0,360]){const clipped=unwrapped.map(ring=>clip(clip(ring.map(([x,y])=>[x+offset,y]),-180,true),180,false));if(clipped[0].length<3)continue;output.push(clipped.filter(r=>r.length>=3).map(r=>[...r,r[0]]));}}return {type:'MultiPolygon',coordinates:output};}
await mkdir('public/geo', { recursive: true });
for (const [file, object, output] of [
  ['node_modules/world-atlas/countries-110m.json','countries','countries'],
  ['node_modules/us-atlas/states-10m.json','states','us-states']
]) {
  const topology = JSON.parse(await readFile(file, 'utf8'));
  const collection=feature(topology, topology.objects[object]);
  collection.features=collection.features.filter(f=>f.properties.name!=='Antarctica').map(f=>({...f,geometry:splitGeometry(f.geometry)}));
  await writeFile(`public/geo/${output}.json`, JSON.stringify(collection));
}
