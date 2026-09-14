# 영유아 동영상 AI–교사 관찰기록 비교연구 웹앱 — 프로젝트 계획

## Context

`C:\projects\vllm-human-description`에는 PRD v2(`영유아_AI_교사_관찰기록_비교연구_PRD_v2_최종설계.md`)만 존재하는 빈 프로젝트다.
PRD가 요구하는 것은 일반 설문앱이 아니라 **연구조건을 시스템이 통제하고 원자료·행동로그를 보존하는 연구 데이터 수집 도구**다.

- 교사 20명 × 동일 영상 5편 = 유효 관찰기록 100건 (complete crossed repeated-measures, `Outcome ~ Video + Order + (1|Teacher)`)
- 5개 순환 순서그룹(O1~O5) × 4명 균형 배정
- 영상당 300초 제한, 첫 시청 무중단(seek/pause/speed/텍스트 금지), 이후 재시청 허용, 자동저장, timeout 자동제출
- 교사 원문 / AI 기술문 / Reference Event / Claim Coding 4개 독립 레이어, 제출 원자료 불변(무효화는 flag + 새 attempt)
- 영유아 영상 Private Storage + signed URL + 서버 인가, 참여자에게 AI/Reference/지표 미노출
- 관리자 대시보드·원자료 조회·CSV/XLSX Export·Audit Log, Phase 2에서 AI/Reference/Coding/분석

### 사용자 결정사항 (확인 완료)

| 항목 | 결정 |
|---|---|
| 구현 범위 | **MVP + Phase 2 전체** (Phase 3 제외, 스키마에 확장 여지만) |
| Supabase | 로컬 Supabase CLI(Docker) 개발 + 클라우드 프로젝트 배포 |
| 배포 | Vercel |
| 영상 | 아직 없음 → placeholder/fixture 영상으로 개발, 실제 영상은 관리자 업로드 |
| 연구 규모 조정 | **참여자 수·영상 편수를 관리자 설정으로 조정 가능**하게 일반화. 참여자 수는 언제든 증원 가능, 영상 편수·순서그룹 구조는 **첫 관찰이 시작되기 전까지만** 변경 허용(시작 후 잠금) |

### 연구 규모 일반화 원칙 (PRD 20×5는 기본값)

- `participant_target = P`, `research_video_count = N` 은 `studies` 설정값이며 코드 상수가 아니다. 기본값 20/5.
- 순서그룹은 **N개 순환 라틴방진**으로 자동 생성: 그룹 g의 position p 영상 = `V[((g−1)+(p−1)) mod N + 1]`. 그룹당 목표 인원 = `ceil(P / N)`, `P mod N ≠ 0`이면 관리자 화면에 "완전 균형 불가" 경고(차단 아님).
- 잠금 규칙: 어떤 참여자든 `started_at`이 찍힌 본 관찰이 1건이라도 있으면 `N`·영상 집합·순서그룹 구조 변경 거부(트리거 + 관리자 UI 비활성 및 사유 표시). `P` 증원과 참여자 추가는 시작 후에도 허용(감원은 목표값만 낮추며 기존 참여자에 영향 없음).
- 영상 편수를 바꾸면 관리자 액션 "순서그룹 재생성"이 기존 order_groups/items를 교체하고 audit 기록. 이미 생성된 참여자(아직 시작 전)는 새 그룹 구조로 재배정 필요 → 재생성 시 기존 참여자 배정도 함께 재생성(관찰 미시작이므로 안전).
- KPI·balance 검증·Export·완료조건(§51)은 모두 `P, N, ceil(P/N)` 기반으로 계산. "20 / 20", "100 / 100" 같은 숫자는 설정값에서 파생.
- `CLAUDE.md`에는 "기본 설계 20×5, 규모 변경은 관리자 설정으로만, 시작 후 영상 구조 변경 금지, incomplete-crossed(참여자별 다른 영상 부분집합) 설계 금지"로 기술.

환경 확인: Node 24.15, npm 11.12, pnpm 11.13, Supabase CLI 2.107, Docker 29.6, Vercel CLI 설치됨. **ffmpeg 없음** → 테스트 영상 fixture는 `ffmpeg-static` devDependency로 생성.

형제 프로젝트 `C:\projects\dece-child-observation`(Kinder Observation AI)은 다른 서비스라 코드 재사용 대상이 아니다. 동일 스택(Next.js 15 + Supabase + shadcn + Zod + Tailwind 4)과 문서 관례(`CLAUDE.md` 헌장, `scripts/check-*.ts`, `.env.example`)만 참고한다.

---

## 1. 핵심 아키텍처 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 스택 | Next.js 15 App Router + TS, Tailwind 4 + shadcn/ui, Supabase(Postgres/Auth/Storage/RLS), Zod, Vercel, npm | PRD §44 |
| 스키마 관리 | Supabase CLI SQL migrations + `supabase gen types` (ORM 없음) | 트리거·RLS·뷰 중심이라 ORM은 방해 |
| study_settings | `studies` 컬럼형 1행 + `study_settings` append-only 변경이력 | 키 고정·타입 명확, §37 audit 충족 |
| 연구 규모 | `participant_target(P)`, `research_video_count(N)` 설정값 기반. 순서그룹 = N개 순환 라틴방진 자동 생성, 그룹당 목표 ceil(P/N). 첫 관찰 시작 시 구조 잠금 | 사용자 요청: 인원·편수 변동 대응. 완전교차 + 순서 균형은 유지 |
| 참여자 인증 | Supabase Auth 미사용. code+PIN(argon2id, `@node-rs/argon2`) → 서버 서명 JWT(`jose`) httpOnly 쿠키(12h) + `participant_sessions`(revoke) | PRD §6. PIN 재설정·완료 후 차단에 서버측 revoke 필요 |
| 관리자 인증 | Supabase Auth email/password(`@supabase/ssr`) + `admin_users` allowlist. 회원가입 UI 없음 | §42 |
| DB 접근 | 참여자 경로: 서버 전용 service-role + 모든 요청에서 `observation.participant_id === session.pid` 검증(불일치 404). 관리자: RLS `is_admin()` + 트랜잭션은 SQL 함수 | 참여자는 Supabase JWT가 없어 RLS로 격리 불가 |
| 불변성 | **DB 트리거로 강제**(service-role은 RLS 우회). submitted 수정 거부, DELETE 거부, append-only 테이블, `started_at` 1회만 | §13, §15, §42, §47 |
| API 형태 | 참여자 경로는 Route Handlers(JSON 계약, sendBeacon 호환). 관리자 폼은 Server Actions 허용하되 로직은 `lib/services/*` 공유 | 페이지 이탈 시 beacon 필요 |
| 타이머 권위 | 서버 `started_at` + 모든 참여자 요청마다 remaining 재계산, ≤0이면 서버가 timeout 제출(lazy finalize). Vercel Cron 보조 | §12, §13 |
| 진행단계 판정 | `participant.status`는 관리자용 표시값. 실제 판정은 사실 기반 순수함수 `resolveNextStep`을 각 page.tsx의 `guardStep()`에서 호출 | 상태 컬럼 오염에도 복구 가능, 단위테스트 용이 |
| 연습 관찰 | `observations.is_practice=true`(presentation_order NULL) + 모든 분석 뷰에서 제외 | 파이프라인 100% 재사용, §9 구분 저장 |
| 카운터 | replay/pause/seek/buffering은 **서버가 제출 시 이벤트에서 파생** | 변조 방지, 원자료-요약값 일관성 |
| 첫 시청 pause | 즉시 자동 재개 + `first_watch_blocked_action` 로그, 2초 내 재개 실패 시 0초 재시작 | "원칙적 금지" + 참여자 시간 최소 소모 |
| 제출 후 이동 | `/study` 허브로(다음 관찰은 버튼으로 시작) | 타이머는 "실제 첫 재생"에 시작해야 하므로 자동 연속재생 금지 |
| XLSX / CSV | `exceljs` / 자체 RFC4180 + UTF-8 BOM | SheetJS npm 중단·CVE, Excel 한글 깨짐 방지 |
| 시각 | 모든 timestamp `timestamptz`, 서버 `now()` 기준. 클라이언트 시각은 metadata 보조 | §13 |
| 워터마크 | 기본 ON(`studies.watermark_enabled`) `연구참여용 T07` 오버레이 | §28 선택사항, 유출 억제 |

---

## 2. 데이터베이스 설계 (`supabase/migrations`)

순서: `0001_enums` → `0002_tables` → `0003_integrity_triggers` → `0004_functions` → `0005_views` → `0006_rls` → `0007_storage`.

### 2.1 Enums
`study_status`(§38), `participant_status`(§26 8종), `observation_status`(pending/in_progress/submitted/invalidated), `submission_type`(manual/timeout), `timer_mode`, `video_kind`(research/practice), `event_type`(§14 16종 + `video_error`, `first_watch_blocked_action`, `first_watch_restarted`), `source_type`(teacher/ai), `support_type`(§19), `accuracy_level`(correct/partial/incorrect/not_applicable), `audit_action`(§39 + participant_pin_reset/withdrawn, video_updated, ai_run_updated, claim_*, study_status_changed).

### 2.2 테이블 (PRD §35 전부)
- **studies**: code, name, status + 설정 컬럼(`participant_target=20 CHECK ≥1, research_video_count=5 CHECK 2..20, max_observation_seconds=300, first_watch_seek/pause/text_enabled=false, replay_enabled=true, playback_rate=1.0, practice_video_id, ai_runs_per_video=3 CHECK 1..5, mobile_allowed=false, timer_mode='effective_time', watermark_enabled=true, consent_version, security_notice_version, settings_locked_at, structure_locked_at`). `participant_video_count`는 항상 `research_video_count`와 같으므로 별도 컬럼 없이 뷰에서 노출(완전교차 강제). `structure_locked_at`은 첫 본 관찰 `started_at` 시 트리거가 자동 세팅.
- **study_settings**: 변경이력 append-only(setting_key, old/new jsonb, changed_by, reason).
- **admin_users**: id = auth.users.id, email, role(admin/coder), active.
- **audit_logs**: §39 필드 + ip, user_agent. append-only.
- **videos**: §28 필드 + `kind, mime_type, file_size_bytes, age_group, sort_order`. `UNIQUE(study_id, code)`, 활성 연습영상 1편 부분 UNIQUE, 연구영상 duration 은 `lib/video-limits.ts` 기준 최대 90s(업로드 finalize 에서 거부), 30s 미만은 관리자 경고만(DB 는 `> 0` CHECK, NULL 허용).
- **order_groups**(code `O1..ON`, `group_index`, `target_participants` = ceil(P/N) 저장값, `generation int` 재생성 세대) / **order_group_items**(position ≥1, video_id; `UNIQUE(group,position)`, `UNIQUE(group,video)`; position ≤ N은 트리거 `check_position_in_range`로 study 설정과 비교).
- **participants**: code, pin_hash, order_group_id NOT NULL, status, `is_valid`, `replaced_participant_id`, `guide_acknowledged_at`, practice_completed_at/started_at/completed_at/last_seen_at, failed_pin_attempts/locked_until, device/browser_category, user_agent_first, notes_admin. `UNIQUE(study_id, participant_code)`.
- **participant_sessions**: sid, participant_id, issued/expires/revoked_at, ip, ua.
- **participant_consents**: consent_type(research/video_security), consent_version, items_json, consented, consented_at, ua. append-only.
- **participant_demographics**: §16 필드(DB text, 값 목록은 Zod enum), extra_json.
- **participant_order_assignments**: 정본 배정표. `UNIQUE(participant, presentation_order)`, `UNIQUE(participant, video)`. presentation_order ≤ N 트리거 검증. 참여자당 행 수 = N(뷰에서 검증).
- **observations**: §36 전부 + `is_practice`, `deadline_at`, `first_watch_seconds`, `page_hidden_count/seconds`, `draft_text/draft_revision/draft_saved_at`(작업본; 제출본 `observation_text`는 제출 시에만 기록), text stats 3종, `invalidated_at/by`, `device_category/browser_category`, `client_info`.
  제약: `UNIQUE(participant, video, attempt_number)`; 부분 UNIQUE `(participant, video) WHERE NOT invalidated AND NOT is_practice`, `(participant, presentation_order) WHERE 동일`; `is_practice OR presentation_order IS NOT NULL`; submitted면 text/submitted_at/submission_type NOT NULL; invalidated면 reason NOT NULL.
- **observation_events**: bigserial, observation/participant/video_id, event_type, `event_timestamp`(서버 보정 시각), `client_timestamp`, `client_session_id uuid`, `seq int`, video_current_time_ms, metadata_json. `UNIQUE(observation_id, client_session_id, seq)` → 재전송 idempotent.
- **ai_prompts**: §22. `UNIQUE(study, prompt_code, version)`, active 1개 부분 UNIQUE.
- **ai_runs**: §21.2 + text stats + `input_description`, `superseded_by`. `UNIQUE(study, video, prompt_version_id, run_number)`.
- **reference_events**: §17.4 + `event_code`, `behavior_category`, `is_consensus`, `deleted_at` + **reference_event_versions**(변경 전 스냅샷).
- **reference_coder_records**: Phase 3 확장용 스키마만.
- **coding_sessions** / **response_claims**(claim_order, claim_text, char_start/end) / **claim_codings**(§19 필드, granularity 1..3, `UNIQUE(claim, coder)`).

### 2.3 트리거 (`0003`) — 연구 무결성의 핵심
1. `observations_guard_submitted`: submitted 행은 `invalidated*`, `technical_issue`, `updated_at`만 변경 허용. invalidated 행은 UPDATE 전면 거부. submitted 전환 시 `observation_text := draft_text`, `submitted_at := now()` 강제 + text stats 계산. `started_at` NULL→값 1회만. participant/video/order/attempt 불변.
2. `observations_no_delete`, `observation_events_append_only`(제출 후 30초 유예 late event만 INSERT 허용), `audit_logs/study_settings/participant_consents` append-only.
3. `ai_runs_guard`(generated_text 등 불변, DELETE 거부), `reference_events_version`(UPDATE/DELETE 전 스냅샷, 물리 삭제 → soft delete), `videos_guard`(제출 기록 있는 영상의 storage_path 교체 거부).
4. `participants_guard`: 시작 이후 `order_group_id` 변경은 `app.admin_override`(SQL 함수 내 `set_config(...,true)`) + audit 있을 때만. DELETE 거부.
5. `study_active_lock`: active에서 실험조건 컬럼 변경 시 override 필수 + `study_settings` 이력 자동 INSERT.
6. `assignments_match_group`, `response_claims_source_check`(polymorphic 참조 검증, 대상 obs는 submitted & valid).
7. `study_structure_lock`: 본 관찰 `started_at`이 처음 세팅될 때 `studies.structure_locked_at := now()`. 잠긴 뒤에는 `research_video_count` 변경, `videos(kind='research')`의 INSERT/active 토글/삭제, `order_groups`/`order_group_items` 변경, 참여자 `order_group_id` 변경(override 예외)을 모두 거부. `participant_target` 변경은 잠금과 무관하게 허용(값이 유효 참여자 수보다 작아지면 경고만).
8. `check_position_in_range`: `order_group_items.position`, `participant_order_assignments.presentation_order`, `observations.presentation_order` ≤ `studies.research_video_count`.

### 2.4 SQL 함수 (`0004`, SECURITY DEFINER, 단일 트랜잭션)
- `create_participant_with_assignments(study, code, pin_hash, order_group, admin)` → participant + assignments 5 + observations 5(attempt 1) + 연습 obs 1 + audit. 그룹 초과 시 경고 반환(대체 참여자 허용).
- `invalidate_and_retry(observation, reason, admin, create_retry)` → invalidated + attempt+1 pending + participant 상태 되돌림 + audit 2건.
- `submit_observation(observation, type)` → `FOR UPDATE`, 이벤트 집계(replay/pause/seek/buffering/first_watch/hidden) → 컬럼 채움, 마지막이면 participant completed + 세션 revoke. 연습이면 practice_completed.
- `observation_timer_state(observation)` → wall/buffering/effective/remaining. TS `lib/timer.ts`와 동등성 테스트.
- `compute_text_stats(text)` → chars/words/sentences (TS `lib/text-stats.ts`와 동일 규칙: 문장 `[.!?。]\s*|\n+`).
- `change_order_group(participant, new_group, admin, reason)`, `update_study_settings(study, patch, admin, reason)` — override + audit 포함.
- `regenerate_order_groups(study, admin)` — `structure_locked_at IS NULL`일 때만. 활성 연구영상 `sort_order` 순으로 N개 확인(N ≠ 영상 수면 거부) → 기존 order_groups/items/participant_order_assignments/미시작 observations 삭제 후 순환 라틴방진으로 재생성 → 기존 참여자(모두 미시작)를 라운드로빈으로 재배정 → `generation+1`, audit(`order_groups_regenerated`, before/after 스냅샷). 이 함수만 예외적으로 삭제를 수행하며, 삭제 대상은 시작 전 배정 구조뿐이다(제출 원자료 없음).
- `create_participant_with_assignments`는 `order_group_items`에서 N개를 복사하므로 N에 자동 대응. 그룹 자동 추천은 `valid_count < target_participants`인 그룹 중 최소 `group_index`.

### 2.5 뷰 (`0005`)
`v_observation_metrics`, `v_research_master`(§34 필드, 1행 = 유효 teacher×video), `v_participant_progress`, `v_video_progress`(목표 = P), `v_order_group_balance`(목표 = ceil(P/N)), `v_order_balance_check`(§27 4항목을 P/N 기반으로: 참여자당 N편, 영상당 P건, 영상×position ceil(P/N)회, 그룹당 ceil(P/N)명 → check_name/expected/actual/pass; `P mod N ≠ 0`이면 `balanced_possible=false` 행 추가), `v_dashboard_kpi`(§25, 목표값 P·P×N·N 파생), `v_data_collection_complete`(§51을 P/N으로 일반화), `v_analysis_summary`(§32.1), Phase 2: `v_human_detection_rate`(§24), `v_claim_metrics`(§23 P/R/F1/Omission/Hallucination/Inference/Temporal/AAO/Granularity, source×video×run 단위).

### 2.6 RLS (`0006`) / Storage (`0007`)
- 모든 테이블 RLS + FORCE. anon 정책 없음. authenticated는 `is_admin()`일 때 SELECT 전체, 관리자 편집 테이블만 INSERT/UPDATE. observations/events/audit/sessions는 관리자도 직접 UPDATE 불가.
- 버킷 `videos` private, 경로 `studies/{study_id}/videos/{video_id}.mp4`. `storage.objects`는 `is_admin()`만. 참여자는 signed URL만.

---

## 3. 인증·보안·타이머·API

### 3.1 참여자 세션
`/enter?code=T07` → `POST /api/participant/login` → lockout(5회/15분) → argon2 → `participant_sessions` INSERT → JWT 쿠키. `lib/auth/participant.ts#requireParticipant()`가 쿠키→JWT→세션 유효→participant 로드, study가 active/pilot 아니면 거부. 완료 시 전 세션 revoke. `middleware.ts`는 쿠키 유무만 검사(DB 없음). 참여자 번들에 Supabase 키 미포함.

### 3.2 관리자
`lib/auth/admin.ts#requireAdmin()` (Supabase 세션 + allowlist). 불변 테이블 갱신·트랜잭션은 service-role로 SQL 함수 호출, audit은 이 경로에서만. 초기 관리자는 `scripts/create-admin.ts`.

### 3.3 영상 signed URL (`POST /api/videos/sign {observation_id}`)
검사: 세션 → 소유 → study active → participant 미완료 → obs pending/in_progress & valid → 이전 순서 모두 submitted(순서 강제; 연습은 status 확인) → remaining > 0(초과면 timeout 제출 후 409) → `createSignedUrl(path, 900)` + `no-store`. 클라이언트는 만료 60초 전 갱신, `MEDIA_ERR_NETWORK` 시 재발급 후 currentTime 복원(free_watch 한정). 관리자용 `/api/admin/videos/[id]/sign` TTL 1h.

### 3.4 서버 타이머
- `POST /api/observations/[id]/start {client_elapsed_ms_since_play}` → 최초 1회 `started_at = now() − elapsed`(상한 10s), 응답 `{started_at, deadline_at, server_now, remaining_seconds}`.
- `POST .../first-watch-complete {max_watched_ms}` → 서버 검증 `(now − started_at − buffering) ≥ duration − 2s` 아니면 `{accepted:false}` → 클라이언트 재시작.
- `buffering_seconds` = buffer_start/end 쌍 합(짝 없는 start는 다음 play/제출까지 capping, 개별 60s 상한 초과 시 `technical_issue=true`).
- `remaining = max − (effective_time ? wall − buffering : wall)`. 모든 참여자 요청에서 ≤0이면 `submit_observation(id,'timeout')` 후 `409 TIMED_OUT`. 클라이언트 timeout 제출은 서버 remaining ≤ 2s일 때만 수락. `GET /api/cron/finalize-timeouts`(5분, `CRON_SECRET`).
- 모든 관찰 API 응답 공통: `server_now`, `remaining_seconds`. `GET /api/observations/[id]/clock` 경량 재동기화(30초).
- 자동저장 `draft_revision` 단조 증가, 서버는 더 큰 값만 반영. `first_watch_completed_at` 없으면 422, submitted면 409.

### 3.5 API 목록
**참여자**: `POST /api/participant/{login,logout,consent,profile,guide-ack,device-check}`, `GET /api/participant/state`, `GET /api/observations/[id]`, `GET .../clock`, `POST .../{start,first-watch-complete,submit}`, `PUT .../draft`, `POST /api/events`(배치 ≤50, `text/plain` beacon 허용, seq 중복 `ON CONFLICT DO NOTHING`), `POST /api/videos/sign`.
**관리자**: `/api/admin/{dashboard, participants(+[id]/reset-pin, order-group, withdraw), order-groups, videos(+upload-url, [id]/finalize, [id]/sign), observations(+[id], [id]/events, [id]/invalidate), settings(+status), audit-logs, ai/prompts, ai/runs(+import), reference/events(+import, export), coding/{sessions,claims,codings}, analysis/*}`, `GET /api/exports/[name]?format=csv|xlsx`, `GET /api/exports/all`.
규약 `{ok, data} | {ok:false, code, message}`(`lib/errors.ts`). 참여자 API는 `force-dynamic`, `no-store`, Node runtime.

---

## 4. 참여자 UX

### 4.1 라우트 & 진행 판정
```
app/(participant)/{enter, welcome, consent, profile, guide, practice, study, study/[observationId], complete}
```
`lib/participant/resolveNextStep.ts`(순수함수, 입력: studyStatus, participant.status, guideAcknowledgedAt, hasConsent, hasDemographics, practice obs, main obs[] 유효 최신 attempt) 판정 순서:
1. study ≠ active/pilot 또는 withdrawn/technical_issue → `blocked`(/enter 안내)
2. !hasConsent → welcome  3. !hasDemographics → profile  4. !guideAcknowledgedAt → guide
5. 연습 obs 미제출 → practice  6. 본 obs `in_progress` 존재 → 그 observation(즉시)
7. `pending` 중 최소 presentation_order → study_hub  8. N건(참여자의 유효 배정 수) 모두 submitted → complete. 화면 표기 `관찰 k / N`도 배정 수에서 파생

`lib/participant/guard.ts#guardStep(route)`이 각 page.tsx에서 호출, 허용 집합 밖이면 `redirect`. `/study/[id]`는 타 참여자·미존재 → `notFound()`, 제출됨 → redirect.
status 전이: invited →(consent) consented →(profile) onboarding →(연습 제출) practice_completed →(본 obs1 start) in_progress →(5번째 제출) completed.

### 4.2 온보딩 화면 (§8, §16 카피는 `lib/copy/participant.ko.ts`에 일원화)
- **/enter**: `enterSchema` `T\d{2}` + PIN `\d{4,6}`, 오류/잠금/blocked 문구.
- **/welcome**: §8.1 문구 + 참여환경 카드. 모바일 판정 = 서버 UA 정규식 OR 클라이언트 `pointer:coarse && max-width:1023px`. `mobile_allowed=false`면 `MobileBlockNotice`가 다음 버튼 대체.
- **/consent**: 필수 체크 3개(연구 참여 동의, 저장·녹화·캡처·복제·공유 금지, 연구목적 외 사용 금지) `z.literal(true)`, consent_version·items_json 저장.
- **/profile**: `profileSchema` — years 0..45, months 0..11, `current_child_age_group`(age_0..age_5/mixed/not_homeroom), `observation_record_frequency`(daily/several_per_week/weekly/several_per_month/monthly_or_less), `video_observation_experience`(none/few_times/regular), `generative_ai_experience`(never/tried/sometimes/often). 실명 없음 안내.
- **/guide**: §8.4 6항목 + "처음 시청 중에는 멈추거나 되감을 수 없습니다", "제한시간은 첫 재생 순간부터" → `guide-ack` → /practice.
- **/practice**: `ObservationShell mode="practice"`, 배너 "연습 관찰입니다. 연구 자료에 포함되지 않습니다". 규칙·제한시간 동일.
- **/study 허브**: `관찰 2 / 5` 진행 표시(내부 코드 미노출), "두 번째 관찰 시작하기".
- **/complete**: §52 문구. 이후 모든 관찰 라우트 → /complete.

### 4.3 관찰 화면 컴포넌트
```
page.tsx(server: guardStep + obs 스냅샷 + settings + server_now)
└ ObservationShell (client 오케스트레이터)
   ├ ObservationHeader("관찰 2 / 5") + TimerDisplay
   ├ StudyVideoPlayer
   │   ├ VideoSurface: <video> + WatermarkOverlay + 오버레이(StartOverlay | RestartOverlay | FirstWatchShield | BufferingIndicator | MediaErrorNotice | TimeoutOverlay)
   │   └ PlayerControls (free_watch에서만: 재생/정지, 처음부터, ±5초, 슬라이더, 음소거, 전체화면. 속도 UI 없음)
   ├ ObservationEditor: Textarea + CharCount + AutosaveStatus + UnlockHint
   ├ SubmitBar → SubmitDialog
   └ LiveAnnouncer (aria-live)
```
훅: `useServerClock, useObservationTimer, useVideoPhase, useAutosave, useEventLogger, useSignedVideoUrl, useDeviceCategory`.
`<video>`: `preload="auto" playsInline disablePictureInPicture disableRemotePlayback controlsList="nodownload noplaybackrate noremoteplayback"`, `controls` 미지정, contextmenu 차단, 전체화면은 컨테이너에.

### 4.4 플레이어 상태머신 `lib/player/playerMachine.ts` (순수 reducer → `{state, effects[]}`)
Phase: `preloading → ready | ready_restart → first_watch_playing → first_watch_completed → free_watch`, 횡단 `expired`, `error`.
- preloading: `canplaythrough`(또는 buffered ≥ duration−0.5s) → ready; 서버 스냅샷 `started_at≠null && first_watch_completed_at=null` → ready_restart; 45s 타임아웃(readyState≥3) → ready(`preload_incomplete` 로그).
- first_watch_playing: PAUSED → 즉시 PLAY + blocked 로그, 2s 내 재개 실패 → ready_restart; SEEKING(|Δ|>1.5s) → `SET_TIME(lastGood)`; TIMEUPDATE 점프 >1.5s → 되돌림, maxWatched 단조; RATE≠1 → `SET_RATE(1)`(모든 phase); ENDED & maxWatched ≥ duration−500ms → first_watch_completed(로그, announce, 편집기 포커스), 미달 → ready_restart. 워치독: `currentTime ≥ duration−250ms && paused` → ENDED 처리. duration은 서버 값 우선.
- 차단 수단 중첩: 컨트롤 미렌더 → `FirstWatchShield` 오버레이 → keydown 캡처(Space/K/←/→/Home/End/J/L/숫자/Media키) → 서버 first-watch-complete 검증.
- free_watch: play(is_replay 판정)/pause/seek(from,to,direction,source)/ended 로그. TIMER_EXPIRED → expired(PAUSE, 비활성, 자동제출). MEDIA_ERROR → error(재시도).
- 새로고침 중 첫 시청: "이전 시청이 중단되었습니다. 처음부터 다시 시청합니다. 남은 시간은 계속 줄어듭니다." [다시 시청하기].

### 4.5 타이머 `lib/timer/timerMath.ts` + `useObservationTimer`
서버 응답마다 앵커 `{remainingSeconds, serverNow, receivedPerfNow}`; `remaining = anchor − (performance.now()−received)/1000 + (effective ? localBufferingSinceAnchor : 0)`. 재동기화: start/events/draft 응답, visible, online, 30초 clock. 표시 250ms `mm:ss`; 임계값 >60s 시계 / ≤60s 경고아이콘+"1분 남음"(announce) / ≤30s "곧 종료됩니다" / ≤10s "자동 제출됩니다" — 색상 단독 사용 금지. 0 → draft flush → `submit {timeout}`; 서버 409(아직 남음)면 재앵커.

### 4.6 자동저장 `lib/autosave/autosaveMachine.ts` + `localDraftStore.ts`
3s debounce, 연속 입력 시 10s maxWait; blur/hidden/pagehide(sendBeacon)/online/제출 직전 즉시 flush. 상태 idle|dirty|saving|saved|error|offline → `AutosaveStatus`(role=status). 재시도 1,2,4,8→15s 상한. `localStorage["obs-draft:{id}"]` 동기 기록, 마운트 시 reconcile(로컬 revision > 서버면 로컬 채택 후 저장; submitted면 폐기), reconcile 전 textarea 잠금. 첫 시청 완료 전 draft 요청은 큐 대기. `SubmitDialog`: "제출한 뒤에는 수정할 수 없습니다", 빈 텍스트 확인.

### 4.7 이벤트 로거 `lib/events/eventLogger.ts`
`client_session_id`(페이지 로드마다 uuid) + `seq`. 2초/20건 배치, critical(first_play_started/completed, restarted)은 즉시, pagehide는 sendBeacon, 미전송 큐 `localStorage["obs-events:{id}"]` 보존·재전송. 서버가 `event_timestamp = server_now − (client_now − client_ts)`(상한 60s) 보정. `observation_started` metadata에 device/browser/viewport. `draft_saved/observation_submitted/timeout_submitted`는 서버 자체 기록.

### 4.8 접근성·톤 (§40–41)
본문 17–18px, textarea 최소 240px, WCAG AA. 라우트 진입 시 h1 포커스, 첫 시청 완료 announce 후 textarea 포커스, 다이얼로그 포커스 트랩. 슬라이더 `role=slider aria-valuetext`. 오류는 텍스트+아이콘 `role=alert`. 워터마크 `aria-hidden pointer-events:none` 대각선 반복 0.18 불투명. 제3자 스크립트 없음.

---

## 5. 관리자 화면

| 경로 | 내용 |
|---|---|
| `/admin/login` | Supabase Auth 로그인 |
| `/admin/dashboard` | §25 KPI 8종, 영상별 진행률, 그룹별 배정, balance check, `DATA COLLECTION COMPLETE` 배지, 만료 대기/기술오류 참여자 목록 (§53 질문 8개) |
| `/admin/participants` | §26 표 + 생성(PIN 1회 표시, 개인링크 복사), PIN 재설정, order group 배정(자동 추천 = 미달 그룹 중 최소 code; 시작 후 변경은 사유 필수), 중단 처리, 상세(관찰 목록/세션/동의/기본정보) |
| `/admin/order-groups` | §27 표(N개 그룹, 순서, 배정/목표) + validation 4항목 PASS/FAIL + `P mod N` 경고 + **[순서그룹 재생성]** 버튼(시작 전만 활성, 잠긴 뒤에는 잠금 시각·사유 표시) |
| `/admin/videos` | 목록/메타 편집, signed upload URL로 직접 PUT, `loadedmetadata`로 duration/width/height 자동 채움, 관리자 미리보기, 연습영상 지정. 연구영상 추가/비활성은 구조 잠금 전만 가능, 등록 수 ≠ N이면 대시보드·순서그룹 화면에 경고 |
| `/admin/observations` | §29 필터·표·상세(영상, 원문, 시간, 카운트, 이벤트 타임라인, invalidation) + 무효화·재시도 다이얼로그 |
| `/admin/settings` | studies 설정 + 상태 전이(draft→pilot→ready→active→paused/closed→archived) + active면 사유 필수 + 변경이력. **연구 규모 섹션**: `participant_target`(언제든 변경, 그룹당 목표 자동 재계산 미리보기), `research_video_count`(시작 전만; 변경 시 "영상 N편 등록 → 순서그룹 재생성" 안내 체크리스트), 구조 잠금 상태 표시 |
| `/admin/audit` | audit_logs 조회/필터 |
| `/admin/exports` | §34 13개 + research_master, CSV/XLSX, 전체 zip, export 시 audit |
| `/admin/ai` | 프롬프트 버전 CRUD(활성 1개), run 수동 등록/CSV import, 영상×run 매트릭스(목표 `ai_runs_per_video`) |
| `/admin/reference` | §30: 영상 플레이어(현재시각 → start/end 채우기) + Event 표 인라인 편집, 순서 변경, CSV import/export, 버전 이력 |
| `/admin/coding` | §31 4단: 영상 / Reference Events / 원문(읽기 전용, 텍스트 드래그 선택→Claim 생성, char offset 저장) / Claim 코딩 폼(support_type, AAO/temporal accuracy, granularity, note). 세션 finalize |
| `/admin/analysis` | §32.1 즉시 산출 표 + §32.2 코딩 지표(teacher/AI 분리, 영상·교사·순서·run 필터) + Human Detection Rate 표(§24 4분면 분류). 추론통계 없음 |

---

## 6. 폴더 구조

```
app/(participant)/...            app/admin/...            app/api/{participant,observations,events,videos,admin,exports,cron}
components/{ui,participant,admin,forms}
hooks/*.ts
lib/auth/{participant,admin,session-jwt,pin}.ts
lib/db/{service-client,server-client,queries/*}.ts
lib/services/{participants,observations,events,videos,settings,exports,audit,ai,reference,coding,analysis}.ts
lib/participant/{resolveNextStep,guard,device}.ts
lib/player/{playerMachine,videoBindings}.ts   lib/timer/timerMath.ts   lib/timer.ts(서버)
lib/autosave/{autosaveMachine,localDraftStore}.ts   lib/events/{eventLogger,eventTypes}.ts
lib/validation/*.ts(Zod)   lib/export/{csv,xlsx,datasets,codebook}.ts
lib/{order-balance,text-stats,errors,env,api-response}.ts   lib/copy/participant.ko.ts
types/{database.ts(generated),domain.ts}
supabase/{config.toml,migrations/*.sql}
scripts/{seed-study,seed-participants,seed-test-study,validate-balance,create-admin,make-test-video}.ts
tests/{unit,db,e2e,fixtures}
middleware.ts, CLAUDE.md(§54 원문), docs/{API.md,DATA_MODEL.md,RUNBOOK.md}, .env.example, vitest.config.ts, playwright.config.ts, vercel.json(cron)
```

env: 서버 `SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PARTICIPANT_SESSION_SECRET, CRON_SECRET, VIDEO_SIGNED_URL_TTL_SECONDS, APP_BASE_URL`; 관리자 클라이언트 `NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY`. `lib/env.ts`에서 Zod 부팅 검증.

---

## 7. 구현 단계

각 단계는 "완료 조건"이 통과해야 다음으로 넘어간다.

| # | 단계 | 산출물 | 완료 조건 |
|---|---|---|---|
| 0 | 초기화 | `create-next-app`(TS, Tailwind, App Router, src 없음), shadcn init + 기본 컴포넌트, `supabase init`, `CLAUDE.md`(§54 원문 + 운영 규칙), `lib/env.ts`, ESLint/Vitest/Playwright 설정, `.env.example`, `scripts/check-forbidden.ts`(public URL·하드코딩 프롬프트 검출) | `npm run build`, `npm test` 통과 |
| 1 | DB | migrations 0001~0007, `db:types`, `scripts/seed-study.ts`(study P=20/N=5 기본, V01~V05+P01 placeholder, `regenerate_order_groups`로 O1~O5 생성, prompt V1, admin) + `lib/order-balance.ts`(N·P 파라미터화: 라틴방진 생성 + 4항목 검증), `lib/text-stats.ts`, `lib/timer.ts` | `supabase db reset` 성공, seed validation PASS(N=5·P=20 및 N=7·P=21 케이스), `tests/db/*`(트리거 불변성·구조 잠금·재생성·함수·뷰·timer 동등성) 통과 |
| 2 | 인증 | `lib/auth/*`, participant login/logout/state, admin login + allowlist, `middleware.ts`, `scripts/create-admin.ts`, `scripts/seed-participants.ts`(T01~T20 4명씩, PIN CSV → gitignore) | API 테스트: 타 참여자 obs 404, 잠금, revoke |
| 3 | 참여자 온보딩 | `resolveNextStep`+`guard`, enter/welcome/consent/profile/guide 화면·API, 모바일 차단, 카피 파일 | 단위테스트 + 브라우저에서 단계 건너뛰기 redirect 확인 |
| 4 | 관찰 엔진 | `playerMachine`, `timerMath`, `autosaveMachine`, `eventLogger`(+단위테스트 먼저), 관찰 API(start/first-watch/draft/submit/clock/events/sign), `ObservationShell` 및 하위 컴포넌트, practice/study 허브/complete, cron | 단위테스트 통과, 로컬 fixture 영상으로 첫 시청 제한·타이머·자동저장·timeout·복구 수동 확인 |
| 5 | 관리자 수집관리 | dashboard, participants, order-groups, videos(업로드), observations(+무효화/재시도), settings, audit | DoD 1~8, 21~26 수동 통과 |
| 6 | Export | `lib/export/*`, datasets 레지스트리, codebook 자동생성, CSV/XLSX/zip 라우트, exports 화면 | DoD 27~28: export만으로 참여자×영상×순서×시간×원문 재구성 |
| 7 | MVP E2E | Playwright: onboarding, first-watch, free-watch, refresh, autosave, timeout, full-flow, mobile-block, isolation, admin-flow(`seed-test-study`로 20초 제한 study) | DoD 1~28 자동 통과 |
| 8 | AI 레이어 | ai_prompts/ai_runs 서비스·API·화면, CSV import(Zod 검증, prompt version 필수) | run 3개/영상 등록, 변경 시 이전 run 보존 테스트 |
| 9 | Reference Annotation | reference 서비스·API·화면, CSV import/export, 버전 이력 UI | Event CRUD + audit/version 테스트 |
| 10 | Claim Coding | coding_sessions/claims/codings 서비스·API·workspace | 원문 불변 확인, 코딩 저장/복구 |
| 11 | 분석 + Phase 2 export | `v_claim_metrics`, `v_human_detection_rate`, analysis 화면, `response_claims/claim_codings/analysis_summary` export 실데이터 | DoD 29~34 |
| 12 | 배포 | `supabase link` + `db push`, storage 버킷, Vercel 프로젝트·env·cron(`vercel.json`), `docs/RUNBOOK.md`(연구 시작 체크리스트: 영상 업로드 → 참여자 생성 → active 전환) | 프리뷰 배포에서 E2E 핵심 시나리오 통과 |

권장 순서 내 원칙: **순수 로직(상태머신·타이머·균형검증·트리거)은 UI보다 먼저 테스트로 고정**한다.

---

## 8. 검증

- **단위(Vitest)**: `order-balance`(§47 Order Tests 4개를 N=5/P=20 기본 + N=6/P=24, N=5/P=23(불균형 경고) 등 파라미터 케이스로), `timer.ts`/`timerMath`(300초, refresh 무관, buffering 차감, 허용오차, 임계값), `playerMachine`(첫 시청 seek/pause/rate/text 차단, 완료 epsilon, 재시작, free_watch 허용), `autosaveMachine`, `eventLogger`, `resolveNextStep`, Zod 스키마, `csv.ts`, `text-stats`.
- **DB 통합(Vitest + pg, 로컬 Supabase)**: submitted 수정 거부, DELETE 거부, append-only, `started_at` 재설정 거부, 첫 관찰 시작 → `structure_locked_at` 세팅 및 이후 N 변경·영상 추가·그룹 재생성 거부, 시작 전 N=5→7 변경 + 재생성 → 그룹 7개·기존 참여자 재배정 확인, `participant_target` 증원은 잠금 후에도 허용, `create_participant` → obs 5+1, `invalidate_and_retry` → attempt 2, `submit_observation` 집계, balance 뷰 PASS, timer SQL=TS, ai_runs 불변, reference 버전 스냅샷, 관리자 RLS(참여자 데이터 UPDATE 불가).
- **API 보안(Vitest)**: 타 참여자 observation 404, 완료 후 sign 401/403, study inactive 로그인 거부, signed URL 만료, 버킷 public 아님 확인 스크립트.
- **E2E(Playwright)**: §7 표의 10개 spec. fixture는 `scripts/make-test-video.ts`(`ffmpeg-static`, testsrc 6초+오디오).
- **수동 DoD**: PRD §56 1~34 체크리스트를 `docs/RUNBOOK.md`에 수록하고 단계 5/7/11에서 확인.
- **정적 검사**: `npm run check` = typecheck + lint + `check-forbidden`(public storage URL, 하드코딩 프롬프트, 참여자 화면 내 "Precision/Recall/Hallucination/V0\d" 문자열).

---

## 9. 진행 상태 (2026-09-10 기준)

| 단계 | 상태 | 검증 |
|---|---|---|
| 0 초기화 | 완료 | `npm run check` |
| 1 DB (migrations 0001~0009, seed) | 완료 | `tests/db` 25 |
| 2 인증 (참여자 PIN 세션, 관리자 allowlist) | 완료 | E2E participant/admin |
| 3 참여자 온보딩 | 완료 | E2E participant |
| 4 관찰 엔진 (첫 시청 제한·타이머·자동저장·이벤트·timeout) | 완료 | 단위 110 + E2E participant 6 |
| 5 관리자 수집 관리 | 완료 | E2E admin 5 |
| 6 Export (13개 + research_master + codebook, CSV/XLSX) | 완료 | E2E admin/phase2 |
| 7 MVP E2E | 완료 | `tests/e2e/participant.spec.ts`, `admin.spec.ts` |
| 8 AI 레이어 (프롬프트 버전, run 등록/CSV import, superseded) | 완료 | E2E phase2 |
| 9 Reference Annotation (CRUD, 순서, CSV, 버전 이력) | 완료 | E2E phase2 |
| 10 Claim Coding (세션, 선택/자동 분할, 코딩, 확정) | 완료 | E2E phase2 |
| 11 분석 (§32.1, P/R/F1 등, Human Detection Rate 4분면) | 완료 | E2E phase2 |
| 12 배포 준비 | 문서·cron·빌드 완료, 실제 Supabase 클라우드/Vercel 연결은 운영자 작업 | `docs/RUNBOOK.md`, `next build` |

### 계획 대비 변경점

- Next.js 16 (계획 시 15) — `proxy.ts`, async `params`, React Compiler 린트 규칙 적용.
- 완료 시 참여자 세션 revoke 제거 (완료 화면 표시 필요). 영상 재열람 차단은 진행단계 판정으로 수행.
- E2E 는 Playwright 번들 Chromium 대신 시스템 Chrome 채널 (H.264).
- 로컬 Supabase 포트 55xxx (다른 프로젝트와 충돌 회피).
- `all.zip` 대신 `all.xlsx` 다중 시트 제공.
