# 영유아 동영상 AI–교사 관찰기록 비교연구 웹앱

어린이집 교사(P명)가 동일한 연구영상(N편)을 정해진 순서로 관찰하고 자유서술형 기록을 작성하는 **연구 전용 데이터 수집 시스템**. 생성형 AI 기술문·Reference Annotation·Claim Coding 레이어와 분석용 export 를 포함한다.

- 요구사항: `docs/PRD_v2.md` · 설계/계획: `docs/PLAN.md` · 개발 원칙: `CLAUDE.md`
- 운영 절차: `docs/RUNBOOK.md` · API: `docs/API.md` · 데이터 모델: `docs/DATA_MODEL.md`

## 스택

Next.js 16 (App Router, Node runtime) · TypeScript · Tailwind 4 + shadcn/ui · Supabase (Postgres / Auth / Private Storage / RLS) · Zod 4 · Vitest · Playwright · Vercel (Cron)

## 로컬 실행

```bash
npm install
npm run db:start                 # Docker 기반 로컬 Supabase (포트 55321/55322)
cp .env.example .env.local       # `supabase status -o env` 값으로 SUPABASE_URL / SERVICE_ROLE_KEY / ANON_KEY 채우기
npm run db:reset                 # migrations 적용
npm run make:test-video          # 합성 테스트 영상 fixture 생성 (ffmpeg-static)
npm run seed -- --upload-fixtures   # study 'main', 영상 V01..V05 + P01(파일 업로드), 순서그룹, 프롬프트 v1, 관리자
npm run seed:participants        # T01..T20 생성, PIN 은 scratch/participants-pins.csv
npm run dev                      # http://localhost:3000  (참여자 /enter, 관리자 /admin)
```

연구를 `active` 로 전환해야 참여자가 접속할 수 있다 (`/admin/settings` 또는 `set_study_status`).

## 검증

```bash
npm run check        # typecheck + lint + 금지 패턴(참여자 화면 지표/코드 노출, 공개 URL, 키 노출)
npm test             # 단위: 순서 균형, 타이머, 텍스트 통계, 플레이어 상태머신, 자동저장, 이벤트 로거, CSV
npm run test:db      # 로컬 Supabase 통합: 트리거 불변성, 구조 잠금, 재생성, 제출/timeout, 무효화·재시도
npm run seed:test && npm run test:e2e   # Playwright (시스템 Chrome): 참여자 흐름, 관리자, Phase 2
```

## 구조

```
app/(participant)/   접속·환영·동의·기본정보·안내·연습·본 관찰·완료
app/admin/           로그인 + (protected) 대시보드·참여자·순서그룹·영상·관찰기록·AI·Reference·Coding·분석·Export·설정·감사로그
app/api/             참여자 API, 이벤트 수집, signed URL, 관리자 업로드, export, cron
lib/services/        도메인 로직 (participant-auth, observations, videos, admin/*)
lib/player|timer|autosave|events   순수 클라이언트 로직 (단위테스트)
supabase/migrations/ 스키마·트리거·함수·뷰·RLS·Storage (정본)
scripts/             seed, 관리자 생성, 테스트 영상, 금지 패턴 검사
tests/{unit,db,e2e}
```
