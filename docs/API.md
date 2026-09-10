# API 계약

응답 규약: `{ ok: true, data, server_now }` 또는 `{ ok: false, code, message, details?, server_now }`. 참여자 API 는 모두 `Cache-Control: no-store`, Node runtime.
에러 코드는 `lib/errors.ts` (`UNAUTHENTICATED`, `NOT_FOUND`, `VALIDATION`, `INVALID_CREDENTIALS`, `LOCKED_OUT`, `STUDY_INACTIVE`, `PARTICIPANT_BLOCKED`, `MOBILE_NOT_ALLOWED`, `ORDER_VIOLATION`, `ALREADY_SUBMITTED`, `TIMED_OUT`, `FIRST_WATCH_REQUIRED`, `TOO_EARLY_FOR_TIMEOUT`, `OBSERVATION_CLOSED`, `STRUCTURE_LOCKED`, …).

## 참여자 (세션 쿠키 `pst`, JWT HS256, 12시간)

| Method | Path | 본문 | 설명 |
|---|---|---|---|
| POST | `/api/participant/login` | `{participant_code, pin}` | code+PIN → 세션. 5회 실패 시 15분 잠금. 진행 중(active/pilot) 연구 우선 |
| POST | `/api/participant/logout` | | 세션 revoke |
| GET | `/api/participant/state` | | `{participant, study, step}` — 만료 관찰 정리 후 진행단계 판정 |
| POST | `/api/participant/device-check` | `{viewport_width, viewport_height, coarse_pointer, user_agent?}` | 기기 분류 저장. 모바일 차단 시 403 |
| POST | `/api/participant/consent` | `{participate, no_copy, research_only, consent_version}` | 동의 2종 append |
| POST | `/api/participant/profile` | §16 필드 | 기본정보 upsert |
| POST | `/api/participant/guide-ack` | | 안내 확인 → 다음 단계 |
| GET | `/api/observations/[id]` | | 관찰 스냅샷(초안, 타이머, 영상 메타) |
| POST | `/api/observations/[id]/start` | `{client_elapsed_ms_since_play}` | 첫 재생 → `started_at` 1회 설정(최대 10초 보정). 순서 강제 |
| POST | `/api/observations/[id]/first-watch-complete` | `{max_watched_ms}` | 서버 검증 `(now−started−buffering) ≥ duration−2s` → `{accepted}` |
| PUT/POST | `/api/observations/[id]/draft` | `{text, revision}` | 자동저장(revision 단조). 첫 시청 전 422, 만료 시 409 `TIMED_OUT` |
| POST | `/api/observations/[id]/submit` | `{submission_type, text?, revision?}` | manual / timeout(서버 remaining ≤ 2초일 때만) → `{next}` |
| GET | `/api/observations/[id]/clock` | | 서버 타이머 재동기화 |
| POST | `/api/events` | `{observation_id, client_session_id, client_now, events[≤50]}` | 이벤트 배치(dedupe: session+seq, 서버 시각 보정). `text/plain`(sendBeacon) 허용 |
| POST | `/api/videos/sign` | `{observation_id}` | 서버 인가 후 signed URL(TTL 900초). 현재 단계의 관찰만 |

모든 관찰 API 는 `observation.participant_id === session.pid` 를 검사하며 불일치는 404, 만료 시 lazy finalize 후 409 를 반환한다.

## 관리자 (Supabase Auth + `admin_users` allowlist)

대부분의 관리자 조작은 Server Action(`app/admin/(protected)/*/actions.ts`)으로 수행하며 로직은 `lib/services/admin/*` 에 있다. Route Handler:

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/admin/videos/[id]/upload-url` | Private Storage 1회용 업로드 URL |
| POST | `/api/admin/videos/[id]/finalize` | 업로드 후 메타(duration 등) 저장 + audit |
| GET | `/api/admin/videos/[id]/sign` | 관리자 미리보기 signed URL(1시간) |
| GET | `/api/exports/[name]?format=csv\|xlsx` | 데이터셋 export (`lib/export/datasets.ts` 레지스트리, audit 기록) |
| GET | `/api/exports/all?format=xlsx` | 전체 시트(interaction_events 제외) |
| GET | `/api/cron/finalize-timeouts` | `Authorization: Bearer CRON_SECRET` — 만료 관찰 timeout 마감 |

## SQL 함수 (service_role 전용, `supabase/migrations/0004`, `0008`)

`create_participant_with_assignments`, `regenerate_order_groups`, `change_order_group`, `start_observation`, `complete_first_watch`, `save_observation_draft`, `submit_observation`, `finalize_expired_observations`, `invalidate_and_retry`, `reset_participant_pin`, `withdraw_participant`, `update_study_settings`, `set_study_status`, `ingest_observation_events`, `record_server_event`, `record_audit`, `observation_timer_state`, `compute_text_stats`, `study_targets`.
