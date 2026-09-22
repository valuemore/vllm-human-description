# 운영 RUNBOOK — 영유아 동영상 AI–교사 관찰기록 비교연구

연구자가 시스템을 준비하고, 참여자를 운영하고, 자료를 회수하기까지의 절차. 각 단계의 근거는 `docs/PRD_v2.md`, 설계는 `docs/PLAN.md`.

## 0. 환경

| 환경 | 구성 |
|---|---|
| 로컬 개발 | Docker + Supabase CLI (`npm run db:start`), Next.js dev (`npm run dev`), 포트 55321(API)/55322(DB)/55323(Studio) |
| 운영 | Supabase 클라우드 프로젝트(Postgres·Auth·Private Storage) + Vercel(Next.js, Cron) |

### 환경변수 (Vercel Project Settings → Environment Variables)

| 이름 | 용도 | 노출 |
|---|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 URL | 서버 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 (RLS 우회, 서버 전용) | 서버 |
| `PARTICIPANT_SESSION_SECRET` | 참여자 세션 JWT 서명 비밀 (32바이트 이상) | 서버 |
| `CRON_SECRET` | `/api/cron/finalize-timeouts` 인증 (Vercel 이 `Authorization: Bearer` 로 전달) | 서버 |
| `VIDEO_SIGNED_URL_TTL_SECONDS` | 참여자 영상 signed URL 유효시간 (기본 900) | 서버 |
| `APP_BASE_URL` | 참여 링크 생성용 (예: `https://study.example.org`) | 서버 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 관리자 로그인(Supabase Auth) | 브라우저(관리자 화면만) |

`SERVICE_ROLE`, `SESSION_SECRET`, `CRON_SECRET` 에 `NEXT_PUBLIC_` 접두사를 붙이지 않는다 (`npm run check:forbidden` 이 검출).

## 1. 최초 배포

```bash
# 1) Supabase 클라우드 프로젝트 생성 후 연결
supabase login
supabase link --project-ref <project-ref>
supabase db push                      # migrations 0001~0009 적용 (버킷 videos 는 0007 에서 private 로 생성)

# 2) 관리자 계정 (allowlist)
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
  npm run create:admin -- --email researcher@example.org --password '<12자 이상>'

# 3) 연구 골격 생성 (study 'main', 영상 placeholder V01..V05 + P01, 순서그룹 O1..O5, 프롬프트 v1)
npm run seed                          # 환경변수는 .env.local 대신 운영 값을 export 하고 실행

# 4) Vercel
vercel link
vercel env add ...                    # 위 표의 변수 전부 (Production/Preview)
vercel deploy --prod                  # vercel.json 의 cron 자동 등록 (Hobby: 매일 1회 `0 18 * * *`=03:00 KST, Pro 이상: `*/5 * * * *` 권장)
```

Supabase 대시보드에서 확인할 것:
- Storage → `videos` 버킷이 **Private** 인지 (public 이면 안 됨).
- Auth → Email 로그인 활성, **Sign-up 비활성**(관리자는 스크립트로만 생성).
- Auth → Site URL 을 `APP_BASE_URL` 로.

## 2. 연구 시작 체크리스트 (관리자 화면)

1. `/admin/settings` — 연구 규모(P, N), 제한시간(300초), 타이머 기준(effective_time), 모바일 허용(false), 동의문 버전 확인.
2. `/admin/videos` — 연습영상 1편 + 연구영상 N편 등록. 각 영상 **파일 업로드**(Private Storage 직접 업로드) 후 길이·해상도 자동 채움 확인. 메타데이터(연령대·활동유형·복잡성·등장인물·사물 수) 입력.
3. `/admin/order-groups` — **[순서그룹 재생성]** 실행 → O1..ON 순환 라틴방진, Validation 표 확인.
4. `/admin/participants` — T01..T<P> 생성. 생성 직후 **1회만 표시되는 PIN** 과 개인 링크를 오프라인 문서(실명 매핑표)에 기록. 그룹당 목표 인원(`ceil(P/N)`)이 채워지도록 배정(추천 그룹 자동 표시).
5. `/admin/settings` → 상태 `ready` → `active` (연습영상·파일 등록된 연구영상 N편·순서그룹 N개가 없으면 거부됨).
6. 파일럿: 관리자 본인 코드로 한 번 끝까지 진행해 첫 시청 제한·타이머·제출·완료 화면을 확인. 파일럿 기록은 `/admin/observations` 에서 **무효화** 처리(삭제 불가, 플래그).

**첫 본 관찰이 시작되는 순간 영상 편수·영상 집합·순서그룹 구조가 잠깁니다.** 이후 변경은 DB 트리거가 거부합니다. 참여자 수 증원은 잠금 후에도 가능합니다.

## 3. 운영 중

| 상황 | 조치 |
|---|---|
| 참여자가 PIN 을 잊음 | `/admin/participants/[id]` → PIN 재설정 (기존 세션 종료, 새 PIN 1회 표시) |
| 제출 기록이 있는 영상의 파일 교체 (재인코딩 등 내용이 같은 경우만) | `/admin/videos/[id]` → **교체 사유 입력(5자 이상)** → 파일 교체. 서버가 기존 파일을 `…/<id>.replaced-<시각>.mp4` 로 백업한 뒤 덮어쓰고, 감사 로그(`video_replaced`)에 사유·백업 경로·전후 메타를 기록. 교체 후 `npm run videos:probe` 로 코덱(avc1)·오디오 확인 |
| 네트워크 단절·영상 오류로 기록 손상 | `/admin/observations/[id]` → 사유 입력 후 **무효화 + 새 attempt 생성**. 원문·이벤트는 보존 |
| 중도탈락 | `/admin/participants/[id]` → 참여 중단(withdrawn). 같은 순서그룹에 대체 참여자 생성 시 "대체 대상" 선택 |
| 진행 중 관찰이 만료된 채 남음 | 참여자 재접속 시 즉시, 그 외에는 cron(Hobby 플랜 매일 1회, Pro 5분)이 timeout 제출. 대시보드 "진행 중인 관찰" 표에서 확인 |
| 대시보드 확인 사항 | 등록/완료/진행/미시작, 유효 기록 `x / P×N`, 영상별 `x / P`, 그룹별 `x / ceil(P/N)`, 균형 검증 PASS, 기술오류 참여자 |
| 수집 완료 | 대시보드에 `DATA COLLECTION COMPLETE` 배지 |

## 4. 연구 분석 단계 (Phase 2)

1. `/admin/ai` — 프롬프트 버전 등록(활성 1개) → Gemini 등에서 **연구자가 직접** 생성한 기술문을 영상당 `ai_runs_per_video` 회 등록(수동 또는 CSV import). 시스템은 영상을 외부 API 로 보내지 않는다.
2. `/admin/reference` — 영상별 Reference Event(행위자·행동·대상·신체/도구·관계·시간순서·start/end) 작성. CSV import 가능. 모든 변경은 이력 스냅샷으로 보존.
3. `/admin/coding` — 교사 기록·AI run 별 코딩 세션: 원문 드래그 선택 또는 문장 자동 분할로 Claim 생성 → support_type·대응 Event·정확성·granularity 입력 → **확정(finalize)**. 확정된 세션만 지표에 반영.
4. `/admin/analysis` — 기술통계(§32.1), 교사 vs AI 지표(P/R/F1/Omission/Hallucination/Inference/Temporal/AAO/Granularity), Human Detection Rate 4분면.
5. `/admin/exports` — 전체 파일 export (codebook.csv 포함). 통계분석은 R/Python/SPSS: 설계대로 순서그룹이 균형이면 `Outcome ~ Video + Order + (1 | Teacher)`.

### 4.1 본 수집(2026-09) 결과에 따른 분석 방침 — 고정 순서 설계로 수용 (2026-09-22 연구자 결정)

- 수집 결과: 유효 참여자 20명(T02–T21, T01 은 파일럿으로 `withdrawn` 처리), 유효 기록 100/100, 영상별 20/20. 그러나 순서그룹 배정이 O1=19명, O2=1명(T21), O3–O5=0명으로 **순환 라틴방진 균형이 이루어지지 않았다**(대시보드 `video_position_occurrence`·`group_valid_participants` FAIL, `DATA COLLECTION COMPLETE` 배지는 표시되지 않으며 이후에도 표시되지 않는다).
- 결정: 추가 모집 없이 **고정 순서(V01→V02→V03→V04→V05) 설계**로 수용한다. 순서 효과와 영상 효과가 분리되지 않으므로 `Order` 항을 모형에서 제외하고 `Outcome ~ Video + (1 | Teacher)` 를 사용하며, 순서 미균형은 연구 제한점으로 보고한다.
- T21(O2)은 유일하게 다른 순서로 시청한 참여자다. 기본 분석에는 포함하되, 민감도 분석으로 T21 제외 결과를 함께 보고한다. export 의 `order_group`·`presentation_order` 열은 그대로 유지한다.
- 대시보드 배지·균형 검증 로직은 설계 원칙(PRD §54)대로 두고 변경하지 않는다.
- 2026-09-22 연구 상태 `closed` 전환 완료, `all.xlsx`(teacher_observations 105행 = 유효 100 + T01 5, interaction_events 2,270행) 오프라인 백업 완료.

### 4.2 유효 기록 100건의 품질 플래그 (export 기준, 2026-09-22)

| 구분 | 해당 기록 | 비고 |
|---|---|---|
| 본문 0자 | T06-V03 (전체 마감 timeout, 1,898 s), T21-V03 (manual, seek 97회), T21-V04 (300 s timeout) | **결정(2026-09-22 연구자): 유효 기록으로 유지, 무효화하지 않음.** 텍스트·Claim 기반 지표(글자수·문장수·P/R/F1·Omission 등)에서는 결측(NA) 처리하고, 참여 완료·시간·재생행동 변수에는 포함한다. 코딩 세션은 생성하지 않는다(Claim 0건). 분석 시 `character_count = 0` 으로 식별 |
| timeout 제출 | T06-V03, T20-V01(62자), T21-V02(20자), T21-V04 | T20-V01·T21-V02·V04 는 0010 배포 전(2026-09-15 오전) **영상별 300 s 제한** 조건에서 수집됨. 나머지 96건은 전체 40분 제한 조건. 제한시간 조건 이질성을 제한점으로 보고 |
| 전체 마감 후 시작 (`started_after_total_deadline`) | T06-V04·V05, T20-V02~V05(약 7.9시간 후), T21-V05·V01(약 31시간 후) | T20·T21 은 두 세션에 걸쳐 참여. 시간 제한 없이 작성된 기록 |
| 탭 이탈 60 s 초과 (`page_hidden_seconds`) | T09(4건), T15(5건), T19-V01, T20(3건) | 무효 사유는 아님. 민감도 분석 공변량 후보 |
| 짧은 본문(<30자) | T02-V01(28자), T21-V02(20자) | 유효 |
| 기기 | desktop/edge 75, desktop/chrome 25 | 모바일 0 |

- AI run 15건은 영상당 `gemini-2.5-pro(observe v2)`, `claude-fable-5(observe v3)`, `gemini-2.5-pro(observe v4)` 로, 동일 조건 반복이 아니라 **모델×프롬프트 조건 3종**이다. 분석에서 "AI" 를 단일 조건으로 합치지 말고 run(모델·프롬프트 버전)을 요인으로 다룬다.
- export 의 `response_claims` 에 T01-V01 코딩 시험 세션(미확정, claim 3건)이 남아 있다. 확정되지 않았으므로 지표에 반영되지 않는다.
- 영상 `title_admin` 이 아직 placeholder 다. 코딩 착수 전 `/admin/videos` 에서 실제 제목으로 정리.
- **교사 원문 간 높은 유사도 (초안 작성 중 발견, 2026-09-22)**: T07·T09·T11·T12·T13 은 5개 영상 모두에서 서로 60–84% 유사한 문안(difflib ratio)이고 T06·T08·T10 도 한 묶음이다. 같은 오류(V01 의 공을 "블록"으로 기술)를 공유해 공통 출처(템플릿·생성 도구) 가능성이 있다. 독립 관찰 가정에 영향을 주므로 연구자가 확인하고 처리 방침(유지·민감도 분석·제외)을 기록한다.
- T06 의 V02 기록은 V01 내용(반죽, 손 잡고 걷기)을 담고 있어 영상 착오로 보인다(초안은 hallucination 처리).
- Reference 누락 후보: V05 "굴러간 양배추를 따라가 다시 잡는다"(교사 9명 공통), V02 "냄비에서 블록 붓기". Reference 를 보완하면 해당 초안을 재검토한다.
- 2026-09-22 초안 가져오기 완료: 111 세션 / 561 Claim (`claude-fable-5-1/draft-v1`). V01-T02 는 기존 Claim 1개가 있어 건너뜀.

### 4.3 Claim Coding 초안 워크플로 (마이그레이션 0011, 2026-09-22 연구자 지시)

연구자가 115건(0자 3건 제외 시 112건)을 처음부터 코딩하는 대신, 사전 생성된 초안을 화면에서 **확인·수정 후 저장**한다.

- 초안 생성: 원문(교사 기록·AI 기술문)과 Reference Events 를 텍스트로만 읽고 Claim 분할·코딩값을 작성한다(영상은 보지 않으며 Reference 가 유일한 기준). 지침은 `docs/CODING_DRAFT_RUBRIC.md`, 결과 파일은 `scratch/coding-drafts/drafts.json`(git 제외, 오프라인 보관). 연구 영상을 외부 API 로 보내지 않는다.
- 가져오기: `npm run coding:drafts -- --file scratch/coding-drafts/drafts.json --source "claude-fable-5-1/draft-v1" [--dry-run]`. 코더(기본 `SEED_ADMIN_EMAIL`)의 세션을 열고 Claim 을 원문 verbatim 위치와 함께 만든 뒤, 코딩 행을 `draft_source`·`draft_values`(초안 원본 스냅샷)·`reviewed_at = null` 로 생성한다. 이미 Claim 이 있는 세션은 건너뛴다. 원문·Reference·기존 코딩은 수정하지 않는다.
- 확인: `/admin/coding` 목록의 "미확인 초안" 열 → 세션 열기 → Claim 마다 값(support_type·대응 Event·정확성·granularity·메모 `[초안] 근거`)을 검토·수정 → **확인 후 저장**(`reviewed_at` 기록, `draft_values` 는 보존). 모든 Claim 이 확인되어야 확정(finalize)할 수 있다(서비스 검증 + DB 트리거 `coding_sessions_guard_drafts`).
- 지표는 finalized 세션만 사용하므로 미확인 초안은 분석에 반영되지 않는다. export `claim_codings` 의 `draft_source`·`draft_values`·`reviewed_at`·`draft_changed` 로 초안-확정 일치율을 산출할 수 있다.
- 방법론 주의: 초안은 코더 판단의 앵커가 될 수 있고, 비교 대상 AI(claude-fable-5) 기술문의 초안도 같은 계열 모델이 작성했다. 논문에는 "초안을 AI 가 작성하고 연구자가 전수 검토·확정" 했음과 초안 수정률을 보고한다. 필요하면 제2코더가 초안 없이 독립 코딩해 일치도를 산출한다(코딩 세션은 코더별로 분리됨).

## 5. Definition of Done 체크리스트 (PRD §56)

관리자 1–8 → 참여자 9–20 → 연구자 21–28 → Phase 2 29–34. 자동 검증:

```bash
npm run check          # typecheck + lint + 금지 패턴
npm test               # 단위 110+
npm run test:db        # 로컬 Supabase 통합 25 (트리거·함수·뷰)
npm run seed:test && npm run test:e2e   # Playwright: participant(6) → admin(5) → phase2(4)
```

E2E 는 시스템 Chrome(H.264 재생)을 사용한다. 헤드리스 Chromium 은 mp4 코덱이 없다.

## 6. 데이터 보존·백업

- 제출된 관찰·이벤트·감사로그·동의·설정 이력은 DB 트리거로 수정·삭제가 차단된다.
- Supabase 자동 백업(PITR 권장) 외에 수집 완료 시 `/admin/exports` → `all.xlsx` + `interaction_events.csv` 를 오프라인 보관.
- 영상은 Private 버킷에만 두고 어떤 export 에도 파일 경로를 포함하지 않는다.
