import type {Dataset,Filters,City,Observation} from './types';
export const MODELS: string[];
export const VERIFIED: Set<string>;
export function kstDay(date: Date|string):string;
export function nextUpdate(date?:Date|string):string;
export function validateObservation(o:Observation,cities:City[],sources:Dataset['sources']):string[];
export function citiesFor(data:Dataset,f:Filters):City[];
export function latest(data:Dataset,f:Filters,at?:string):Observation[];
export interface Aggregate {total:number|null;cybercab:number|null;model_y:number|null;coverage:number;asOf:string|null}
export function aggregate(rows:Observation[]):Aggregate;
export function comparableDelta(current:Observation[],previous:Observation[]):number|null;
export function history(data:Dataset,f:Filters,days:string,now?:Date): (Aggregate & {day:string;delta:number|null;records:Observation[];scopeChanged:boolean;carried:Aggregate})[];
export function ingest(data:Dataset,incoming:Observation[],now:string):Dataset;
