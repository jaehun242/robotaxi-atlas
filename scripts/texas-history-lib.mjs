import {createHash} from 'node:crypto';
import {boundedFetch} from './statistics-lib.mjs';

export const TEXAS_HISTORY_SOURCE_ID = 'texas-av-history';
export const TEXAS_HISTORY_URL = 'https://texasavtracker.com/api/data?brand=tesla';
export const TEXAS_HISTORY_PAGE_URL = 'https://texasavtracker.com/tesla';
const START = '2026-06-09';

const metadata = {
  sourceId: TEXAS_HISTORY_SOURCE_ID,
  name: 'Texas Autonomous Fleet Tracker · 등록 스냅샷 파생 차종 집계',
  url: TEXAS_HISTORY_URL,
  verification: 'unofficial',
  scope: 'US-TX',
  basis: 'registered',
  dateBasis: 'UTC_snapshot_day',
  timezone: 'UTC',
  methodology: '출처 history의 각 당시 명부 스냅샷을 현재 명부의 명시적 모델명과 메모리에서만 대조한 파생 집계. firstSeen 누적·VIN 접두어 추정·결측일 보간 없음. 같은 UTC 날짜의 마지막 실제 스냅샷만 채택. 원본 식별자·개별 위치는 저장하지 않음. Texas 등록 전체이며 배치·운행 대수와 다름.'
};

function canonicalTime(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw Error(label);
  return new Date(value).toISOString();
}
function normalizeModel(value) {
  if (typeof value !== 'string') return null;
  const model = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return model === 'cybercab' ? 'cybercab' : model === 'model y' ? 'model_y' : null;
}
function aggregateFields(observation) {
  const {date, cybercab, model_y, total, observedAt, publishedAt, note, snapshotHash, snapshotMembershipHash} = observation;
  return {date, cybercab, model_y, total, observedAt, publishedAt, note, snapshotHash, snapshotMembershipHash};
}
function sameObservation(left, right) {
  const a=aggregateFields(left),b=aggregateFields(right);
  // Adding an aggregate membership hash is metadata, not a numerical correction.
  if (!a.snapshotMembershipHash || !b.snapshotMembershipHash) {delete a.snapshotMembershipHash;delete b.snapshotMembershipHash;}
  return JSON.stringify(a) === JSON.stringify(b);
}

// The public payload includes historical lists. Keep them only in memory and
// return aggregates; do not log, persist, or embed any identifier in errors.
export function parseTexasHistory(payload, {now = new Date().toISOString()} = {}) {
  const checkedAt = canonicalTime(now, '수집 시각 검증 실패');
  if (!payload || !Array.isArray(payload.vehicles) || !Array.isArray(payload.history) || !payload.history.length) {
    throw Error('Texas AV Tracker 과거 스냅샷 구조 변경');
  }
  const models = new Map();
  for (const vehicle of payload.vehicles) {
    if (!vehicle || typeof vehicle.vin !== 'string' || !vehicle.vin) throw Error('현재 모델 분류 구조 변경');
    const model = normalizeModel(vehicle.model);
    if (models.has(vehicle.vin) && models.get(vehicle.vin) !== model) throw Error('같은 식별자의 모델 분류 충돌');
    models.set(vehicle.vin, model);
  }

  const byDay = new Map();
  for (const row of payload.history) {
    const observedAt = canonicalTime(row?.timestamp, '과거 스냅샷 기준 시각 검증 실패');
    if (Date.parse(observedAt) > Date.parse(checkedAt) + 300000) throw Error('미래 스냅샷 거부');
    const date = observedAt.slice(0, 10);
    if (date < START) continue;
    if (!Number.isSafeInteger(row.count) || row.count < 0) throw Error('과거 스냅샷 총계 검증 실패');
    if (row.vins != null && !Array.isArray(row.vins)) throw Error('과거 명부 스냅샷 구조 변경');
    if (row.uncertainVins != null && !Array.isArray(row.uncertainVins)) throw Error('출처 공백 표시 구조 변경');

    const identifiers = row.vins ?? [];
    const unique = new Set(identifiers);
    if (unique.size !== identifiers.length || identifiers.some(id => typeof id !== 'string' || !id)) {
      throw Error('과거 명부 중복·형식 검증 실패');
    }
    const counts = {cybercab: 0, model_y: 0};
    let unmapped = 0;
    for (const identifier of identifiers) {
      const model = models.get(identifier);
      if (model) counts[model]++;
      else unmapped++;
    }
    const complete = row.vins != null && identifiers.length === row.count && unmapped === 0;
    const uncertainCount = new Set(row.uncertainVins ?? []).size;
    const cybercab = complete ? counts.cybercab : null;
    const model_y = complete ? counts.model_y : null;
    const note = [
      '비공식 과거 등록 스냅샷의 파생 차종 집계. 당시 명부와 현재 명시적 모델명을 대조; 실제 영업 대수·등록 발생일 아님.',
      complete ? '스냅샷 전체 모델 대조 완료.' : '모델 분류 미완료 또는 당시 명부 누락으로 차종별 값은 미확인. 총계만 원본대로 보존.',
      uncertainCount ? '출처 공백 후 최초 관측 ' + uncertainCount + '건: 실제 등록일 미상. 이 날짜는 차량 명부 스냅샷 관측일.' : null
    ].filter(Boolean).join(' ');
    const snapshotMembershipHash = createHash('sha256').update(JSON.stringify([...unique].sort())).digest('hex');
    const snapshotHash = createHash('sha256').update(JSON.stringify({
      observedAt, total: row.count, cybercab, model_y, identifierCount: identifiers.length, unmapped, uncertainCount
    })).digest('hex');
    const observation = {
      id: TEXAS_HISTORY_SOURCE_ID + '-' + date,
      sourceId: TEXAS_HISTORY_SOURCE_ID,
      date, cybercab, model_y, total: row.count,
      observedAt, publishedAt: null, firstCollectedAt: checkedAt, lastCheckedAt: checkedAt,
      note, snapshotHash, snapshotMembershipHash
    };
    const previous = byDay.get(date);
    if (previous?.observedAt === observedAt && !sameObservation(previous, observation)) {
      throw Error('동일 시각의 과거 스냅샷 집계 충돌');
    }
    if (!previous || observedAt >= previous.observedAt) byDay.set(date, observation);
  }
  if (!byDay.size) throw Error('조회 기간에 실제 과거 스냅샷 없음');
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function collectTexasHistory(previousSource = null, {
  now = new Date().toISOString(), fetcher = fetch, forceFailure = false
} = {}) {
  const checkedAt = canonicalTime(now, '수집 시각 검증 실패');
  const previous = previousSource ? structuredClone(previousSource) : {};
  const result = {
    ...previous, ...metadata,
    observations: previous.observations ?? [],
    revisions: previous.revisions ?? [],
    lastAttemptAt: checkedAt, lastSuccessAt: previous.lastSuccessAt ?? null,
    checkState: 'failed', error: null
  };
  try {
    if (forceFailure) throw Error('실패 보존 검증용 강제 실패');
    // boundedFetch: at most two 15s attempts; no retry on HTTP 401/403/404.
    const response = await boundedFetch(TEXAS_HISTORY_URL, fetcher);
    const observations = parseTexasHistory(await response.json(), {now: checkedAt});
    const merged = new Map(result.observations.map(row => [row.id, row]));
    for (const observation of observations) {
      const prior = merged.get(observation.id);
      // A missing current model label cannot erase an already validated fixed
      // model on the identical historical snapshot. The whole-list hash proves
      // unchanged membership without persisting individual identifiers.
      const preserveKnownModels = prior && observation.cybercab === null
        && Number.isSafeInteger(prior.cybercab) && Number.isSafeInteger(prior.model_y)
        && prior.observedAt === observation.observedAt && prior.total === observation.total
        && prior.snapshotMembershipHash === observation.snapshotMembershipHash;
      const replacement = preserveKnownModels
        ? {...prior, lastCheckedAt: observation.lastCheckedAt,
          validationNote: '현재 명부의 모델 매핑 일부 누락. 동일 원본 스냅샷의 이전 검증 모델 분할 유지.'}
        : observation;
      if (prior && !sameObservation(prior, replacement)) {
        result.revisions.push({
          observationId: observation.id, changedAt: checkedAt,
          previous: aggregateFields(prior), replacement: aggregateFields(replacement)
        });
      }
      merged.set(observation.id, {
        ...replacement,
        firstCollectedAt: prior?.firstCollectedAt ?? observation.firstCollectedAt
      });
    }
    result.observations = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
    result.lastSuccessAt = checkedAt;
    result.checkState = 'ok';
  } catch (error) {
    result.error = String(error?.message ?? '수집 실패').slice(0, 300) + '. 마지막 정상 기록과 원래 기준 시각 유지.';
  }
  return result;
}

