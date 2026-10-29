// Keep stored evidence intact while limiting the active product to US cities.
export function usOnlyDataset(data){
 const cities=data.cities.filter(c=>c.country==='US'),ids=new Set(cities.map(c=>c.id));
 const within=rows=>rows?.filter(row=>ids.has(row.city));
 return {...data,geographicScope:'US',cities,observations:within(data.observations),services:within(data.services),news:within(data.news),fleetResearch:within(data.fleetResearch),fleetReferences:within(data.fleetReferences)};
}
