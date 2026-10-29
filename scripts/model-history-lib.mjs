export const MODEL_HISTORY_URL = 'https://www.tslafg.com/robotaxi.json';

const SOURCE = {
  sourceId: 'tslafg',
  name: 'TSLA Fear & Greed · Texas robotaxi history',
  url: MODEL_HISTORY_URL,
  verification: 'unofficial',
  scope: 'US-TX',
  basis: 'registered',
  methodology: 'TSLAFG가 FSD Database를 통해 재집계한 TxDMV 텍사스 등록 이력. 동일 DMV 원자료의 재게시이며 독립 검증이 아님. 도시 배정·배치·영업 대수와 구분. 원문에 차종이 없는 날짜는 역산·보간하지 않음.',
  dateBasis: 'publisher_calendar',
  timezone: null,
};
const NOTE = '출처의 일자만 공개됨(시간대·관측 시각 미공개). 모델별 등록 이력이며 실제 운행 대수가 아님.';
const FIELDS = ['txTesla', 'txCybercab', 'txModelY'];
const validDay = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;
const validCount = value => value === null || Number.isSafeInteger(value) && value >= 0;
const countsOf = row => ({ cybercab: row.cybercab, model_y: row.model_y, total: row.total });
const sameCounts = (a, b) => a.cybercab === b.cybercab && a.model_y === b.model_y && a.total === b.total;

// The publisher supplies calendar dates, not timestamped daily observations.
// Keep explicit null rows while parsing so a later withdrawal can be recorded.
export function parseModelHistory(payload) {
  const daily = payload?.daily;
  if (!Array.isArray(daily?.dates) || !daily.dates.length || daily.dates.length > 5000
    || FIELDS.some(field => !Array.isArray(daily[field]) || daily[field].length !== daily.dates.length)) {
    throw Error('TSLAFG 차종 이력 배열·길이 검증 실패');
  }
  const seen = new Set();
  return daily.dates.map((date, i) => {
    if (!validDay(date) || seen.has(date)) throw Error('TSLAFG 차종 이력 날짜 중복·형식 검증 실패');
    seen.add(date);
    const total = daily.txTesla[i], cybercab = daily.txCybercab[i], model_y = daily.txModelY[i];
    if (![total, cybercab, model_y].every(validCount)) throw Error('TSLAFG 차종 이력 대수 검증 실패');
    if (cybercab !== null && model_y !== null && (total === null || cybercab + model_y !== total)) {
      throw Error('TSLAFG 차종 합계와 등록 총계 불일치');
    }
    if (total !== null && [cybercab, model_y].some(value => value !== null && value > total)) {
      throw Error('TSLAFG 차종 대수가 등록 총계를 초과함');
    }
    return { date, cybercab, model_y, total };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export async function collectModelHistory(prior, {
  now = new Date().toISOString(), fetcher = fetch, forceFailure = false,
} = {}) {
  const fallback = { ...SOURCE, observations: [], lastSuccessAt: null, revisions: [], ...prior };
  try {
    if (forceFailure) throw Error('차종 이력 수집 실패 모의');
    // One bounded request. A 403 or another failure never creates a fresh count.
    const response = await fetcher(MODEL_HISTORY_URL, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'RobotaxiAtlas/1.0 (+https://github.com/jaehun242/robotaxi-atlas)' },
    });
    if (!response.ok) throw Error(`TSLAFG HTTP ${response.status}`);
    const rows = parseModelHistory(await response.json());
    const observations = new Map((prior?.observations ?? []).map(row => [row.date, row]));
    const revisions = [...(prior?.revisions ?? [])];
    for (const row of rows) {
      const previous = observations.get(row.date);
      const hasModel = row.cybercab !== null || row.model_y !== null;
      if (previous && (!hasModel || !sameCounts(previous, row))) {
        revisions.push({ sourceId: SOURCE.sourceId, date: row.date, changedAt: now,
          previous: countsOf(previous), replacement: hasModel ? countsOf(row) : null });
      }
      if (!hasModel) {
        observations.delete(row.date);
        continue;
      }
      observations.set(row.date, {
        id: `${SOURCE.sourceId}:US-TX:registered:${row.date}`,
        sourceId: SOURCE.sourceId,
        ...row,
        observedAt: null,
        publishedAt: null,
        firstCollectedAt: previous?.firstCollectedAt ?? now,
        lastCheckedAt: now,
        note: NOTE,
      });
    }
    return { ...SOURCE, observations: [...observations.values()].sort((a, b) => a.date.localeCompare(b.date)),
      lastAttemptAt: now, lastSuccessAt: now, checkState: 'ok', error: null, revisions };
  } catch (error) {
    return { ...fallback, lastAttemptAt: now, checkState: 'failed',
      error: `${error instanceof Error ? error.message : String(error)} · 마지막 정상 차종 이력 보존` };
  }
}
