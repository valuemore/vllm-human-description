# 데이터 모델

정본은 `supabase/migrations/*.sql`. 타입은 `types/database.ts` (`npm run db:types`).

## 레이어

| 레이어 | 테이블 | 불변성 |
|---|---|---|
| 연구 설정 | `studies`(설정 컬럼형), `study_settings`(변경 이력, append-only), `admin_users`, `audit_logs`(append-only) | 실험조건은 active 상태에서 사유+override 필요 |
| 영상·배정 | `videos`, `order_groups`, `order_group_items`, `participant_order_assignments` | 첫 본 관찰 시작 시 `structure_locked_at` → 구조 변경 거부 |
| 참여자 | `participants`, `participant_sessions`, `participant_consents`(append-only), `participant_demographics` | 삭제 금지, withdraw 는 `is_valid=false` |
| 교사 원자료 | `observations`(작업본 `draft_text` / 제출본 `observation_text`), `observation_events`(append-only) | 제출 후 플래그 컬럼 외 수정 불가, 삭제 불가, `started_at` 1회 |
| AI 기술문 | `ai_prompts`(버전), `ai_runs`(`generated_text` 불변, `superseded_by`) | 삭제 불가 |
| Reference | `reference_events`(soft delete), `reference_event_versions`(변경 전 스냅샷) | 물리 삭제 거부 |
| Coding | `coding_sessions`, `response_claims`, `claim_codings` | 세션 확정 후 수정 불가(다시 열기 가능) |

## 연구 규모 파생값

`P = studies.participant_target`, `N = studies.research_video_count` → 그룹당 목표 `ceil(P/N)`, 총 기록 `P×N`. `study_targets(study_id)` 함수와 `v_study_targets` 뷰가 제공하며 코드에 상수를 두지 않는다.

순서그룹: 그룹 g 의 position p 영상 = `V[((g−1)+(p−1)) mod N + 1]` (`regenerate_order_groups`).

## 관찰 상태 흐름

```
pending ──start_observation──▶ in_progress ──submit_observation(manual|timeout)──▶ submitted
   │                                │
   └── invalidate_and_retry ────────┴──▶ invalidated (+ 새 attempt_number 행 pending)
```

타이머: `remaining = max − (timer_mode = effective_time ? wall − buffering : wall)`, `wall = (submitted_at|now) − started_at`, buffering 은 `video_buffer_start/end` 쌍(개별 60초 상한). `observation_timer_state()` 와 `lib/timer.ts` 가 동일 규칙(DB 테스트로 동등성 검증).

## 뷰

| 뷰 | 용도 |
|---|---|
| `v_study_targets` | P, N, per_group_target, balanced_possible |
| `v_valid_observations` | 제출 + 무효화 아님 + 연습 아님 + 유효 참여자 |
| `v_observation_metrics` | 관찰 + 실시간 타이머 상태 (관리자 조회) |
| `v_participant_progress`, `v_video_progress`, `v_order_group_balance` | 진행률 |
| `v_order_balance_check` | PRD §27 4항목 + balanced_possible |
| `v_dashboard_kpi`, `v_data_collection_complete` | §25, §51 |
| `v_research_master` | 1행 = 교사×영상 attempt (분석용 tidy) |
| `v_analysis_summary` | §32.1 기술통계 |
| `v_coding_sources`, `v_coding_progress` | 코딩 대상·진행 |
| `v_claim_metrics`, `v_claim_metrics_full` | 기록별 P/R/F1/Omission/Hallucination/Inference/Temporal/AAO/Granularity |
| `v_human_detection_rate` | Reference Event 별 HDR, AI 포착, 4분면 |

## 지표 정의 (PRD §23, `0009_phase2_views.sql`)

- factual = observed + hallucination, Precision = observed/factual, Hallucination = hallucination/factual
- Recall = 매칭된 distinct Reference Event / 영상의 Reference Event 수, Omission = 1 − Recall, F1 = 2PR/(P+R)
- Inference = (inference_supported + inference_unsupported) / 코딩된 Claim
- Temporal / Actor / Action / Object = correct / (correct + partial + incorrect)
- Granularity = 평균(1 포괄 ~ 3 구체)
- Human Detection Rate = Event 를 observed 로 기술한 교사 기록 수 / 확정 코딩된 교사 기록 수
