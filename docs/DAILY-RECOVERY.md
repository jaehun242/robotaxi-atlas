# 일일 자동 갱신 복구 · 2026-10-30

2026-10-30 08:26 KST 점검에서 주 워크플로의 당일 schedule 실행은 생성되지 않았다. 공개 atlas.lastAttemptAt은 전날19:05 KST였고 daily-2026-10-30 기록도 없었다. 한편 별도 등록부 예약 실행40972725292는08:22:42~08:23:45 KST에 성공했으나 전체 일일 수집은 하지 않았다.

확인된 문제는 주 예약 트리거 지연·누락 상태에서 등록부 작업이 일일 갱신을 복구하지 못하는 구조다. GitHub 내부 지연의 구체적 원인은 실행 자체가 없어 작업 로그로 확정할 수 없다. 현재 GitHub 공식 문법은 IANA timezone을 지원하므로 Asia/Seoul 표기를 오류로 판단하지 않았다.

## 실행 경로

- 주 예약: 매일08:00 Asia/Seoul, 보완08:17·09:17·10:17·11:17 유지.
- 독립된 시간별 등록부 예약: 매시간23분. 08시 이후 공개 atlas의 당일daily기록과 lastAttemptAt을 확인한다.
- 당일08시 이후 성공·부분 성공이 이미 공개되었으면 등록부만 점검한다. 등록부의 checkedAt만 최신인 것은 일일 갱신 성공으로 인정하지 않는다.
- 당일 전체 수집·배포가 없거나 실패했으면 동일 클라우드 작업 안에서 출처 수집→인구 통계 갱신 주기 확인→주별 문서·소식 점검→시나리오 재계산→기록 저장→빌드→Pages 배포를 수행한다.
- 원래 수치 asOf, 뉴스 firstCollectedAt, 잠긴 수동 입력은 기존 수집기의 보존 규칙을 그대로 따른다.
- 오전08시 이전에는 시간별 작업이 전체 일일 수집을 시작하지 않는다.
- 두 워크플로는 같은 publication concurrency group을 사용하고 main 최신 내용을 checkout한다. 공개 배포 성공을 기준으로 중복 전체 수집을 생략한다.

## 재시도 한도와 기록

data/automation-watchdog.json에 GitHub run_id:run_attempt, 한국 날짜, 시작·수집 완료 상태를 저장한다. 전체 출처 수집 전에 시작 기록을 Git에 먼저 저장하므로 빌드·배포 실패 후에도 복구 시도 횟수가 남는다. 동일 workflow attempt 안의 중복 스크립트 호출은 같은 기록을 재사용한다. 실제 GitHub 재실행은 run_attempt가 달라 별도 시도로 센다.

시간별 일일 복구는 한국 날짜별 최대2회다. 깨진 복구 기록은 자동으로 덮어쓰지 않으며 수집을 시작하지 않는다. 다음 한국 날짜에는 새 예산을 사용한다. 수집 완료와 Pages 배포 성공은 별도 상태이며 journal의 collected는 배포 성공을 뜻하지 않는다.

## 수동 점검

기존 GitHub 로그인과 scripts/github-admin.mjs를 사용해 Actions 실행을 조회한다. 즉시 전체 수집은 Collect data and deploy Pages → Run workflow, 누락 감지 경로 검증은 Refresh Texas registrations → Run workflow로 실행한다. 후자는 이미 당일 최신이면 등록부만 확인한다.

2026-10-30 복구 검증은 주 예약 성공으로 보고하지 않는다. 실행 event, 단계별 결과, 공개 atlas.json을 대조해 보고한다.

GitHub Actions는 예약 시작·완료 정각을 보장하지 않는다. 정시 완료 SLA가 꼭 필요하면 별도 외부 스케줄러가 필요하지만, 이번 변경은 새 서비스·비밀키·유료 연결·권한 확대 없이 기존 클라우드 작업의 자동 복구 범위를 보강한다.

공식 문서: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
