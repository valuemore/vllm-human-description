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
vercel deploy --prod                  # vercel.json 의 cron(*/5 * * * *) 자동 등록
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
| 네트워크 단절·영상 오류로 기록 손상 | `/admin/observations/[id]` → 사유 입력 후 **무효화 + 새 attempt 생성**. 원문·이벤트는 보존 |
| 중도탈락 | `/admin/participants/[id]` → 참여 중단(withdrawn). 같은 순서그룹에 대체 참여자 생성 시 "대체 대상" 선택 |
| 진행 중 관찰이 만료된 채 남음 | 참여자 재접속 시 또는 5분 cron 이 자동으로 timeout 제출. 대시보드 "진행 중인 관찰" 표에서 확인 |
| 대시보드 확인 사항 | 등록/완료/진행/미시작, 유효 기록 `x / P×N`, 영상별 `x / P`, 그룹별 `x / ceil(P/N)`, 균형 검증 PASS, 기술오류 참여자 |
| 수집 완료 | 대시보드에 `DATA COLLECTION COMPLETE` 배지 |

## 4. 연구 분석 단계 (Phase 2)

1. `/admin/ai` — 프롬프트 버전 등록(활성 1개) → Gemini 등에서 **연구자가 직접** 생성한 기술문을 영상당 `ai_runs_per_video` 회 등록(수동 또는 CSV import). 시스템은 영상을 외부 API 로 보내지 않는다.
2. `/admin/reference` — 영상별 Reference Event(행위자·행동·대상·신체/도구·관계·시간순서·start/end) 작성. CSV import 가능. 모든 변경은 이력 스냅샷으로 보존.
3. `/admin/coding` — 교사 기록·AI run 별 코딩 세션: 원문 드래그 선택 또는 문장 자동 분할로 Claim 생성 → support_type·대응 Event·정확성·granularity 입력 → **확정(finalize)**. 확정된 세션만 지표에 반영.
4. `/admin/analysis` — 기술통계(§32.1), 교사 vs AI 지표(P/R/F1/Omission/Hallucination/Inference/Temporal/AAO/Granularity), Human Detection Rate 4분면.
5. `/admin/exports` — 전체 파일 export (codebook.csv 포함). 통계분석은 R/Python/SPSS: `Outcome ~ Video + Order + (1 | Teacher)`.

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
