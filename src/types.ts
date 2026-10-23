export type Model = 'cybercab' | 'model_y';
export type Basis = 'allocated' | 'deployed' | 'testing' | 'commercial';
export type Status = 'commercial' | 'limited' | 'testing' | 'preparing' | 'planned' | 'suspended' | 'unknown';
export type Verification = 'official_single' | 'independent' | 'unofficial' | 'estimated' | 'unverified' | 'conflict';
export interface City { id: string; name: string; english: string; country: string; countryName: string; region: string; regionName: string; coordinates: [number,number] }
export interface Observation { id: string; city: string; model: Model; basis: Basis|'unknown'; count: number; asOf: string | null; collectedAt: string; sourceId: string; sourceUrl: string; scope: string; verification: Verification; independentGroups?: string[]; locked?: boolean; scopeId?:string; vehicleDefinition?:string; coverageComplete?:boolean; note: string }
export interface Service { id: string; city: string; model: Model | 'unspecified'; status: Status; safety: 'yes'|'no'|'unknown'; paid: boolean; asOf: string|null; observedAt: string; sourceId: string; sourceUrl: string; verification: Verification; note: string }
export interface News { id:string; city:string; model:string; title:string; summary:string; eventDate:string|null; publishedAt:string|null; firstCollectedAt:string; sourceId:string; sourceUrl:string }
export interface Source { id:string; name:string; url:string; priority:number; access:string; definition:string; automation:string }
export interface SourceRun { sourceId:string; state:string; checkedAt:string; lastSuccessAt:string|null; message:string }
export interface Dataset { version:number; updatedAt:string; lastAttemptAt:string|null; lastSuccessAt:string|null; nextUpdateAt:string; cities:City[]; observations:Observation[]; services:Service[]; news:News[]; sources:Source[]; sourceRuns:SourceRun[]; revisions:unknown[]; runs: {id:string;startedAt:string;completedAt:string;state:string}[] }
export interface Filters { country:string; region:string; city:string; model:string; basis:Basis; status:string; verification:string }
