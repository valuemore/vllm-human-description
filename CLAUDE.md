# CLAUDE.md — 영유아 동영상 AI–교사 관찰기록 비교연구 웹앱

이 파일은 이 저장소에서 작업할 때 **항상 먼저 읽어야 하는** 프로젝트 헌장이다.
원 요구사항은 `docs/PRD_v2.md`, 설계·구현 계획은 `docs/PLAN.md`에 있다.

## 1. 최상위 개발 원칙 (PRD §54 원문)

```text
This application is a research-grade data collection system.

Research validity, data integrity, and child-video privacy are more important
than UI convenience or implementation shortcuts.

DEFAULT STUDY DESIGN (configurable by the administrator, see §2):
- 20 childcare teachers
- exactly 5 research videos
- every teacher watches all research videos (complete crossed design)
- 100 teacher observation records total
- 5 balanced cyclic presentation-order groups
- 4 valid participants per order group

Never reintroduce the previous 10-video incomplete-crossed design
(participants watching different subsets of videos).

Never change experimental timing, presentation order,
first-viewing restrictions, event logging, or submitted research data
without explicit instruction.

For each research video:
1. preload before first playback,
2. start the timer at actual first playback,
3. require one uninterrupted first viewing,
4. disable seeking, replay, and speed changes on first viewing,
5. keep the text area disabled until first viewing completes,
6. then allow replay, pause, and seeking,
7. keep playback speed fixed at 1.0,
8. allow a maximum of 300 seconds (study setting),
9. allow early manual submission,
10. autosubmit the saved response at timeout,
11. preserve all raw interaction events.

Never reset an experimental timer because of browser refresh.
Never overwrite or delete submitted raw research records.
Invalid records must be flagged and replaced with a new attempt.
Never expose child observation videos via public URLs.

Participant-facing screens must not expose:
- AI outputs,
- reference annotations,
- research hypotheses,
- scoring metrics.

The reference annotation unit is:
[Actor] + [Action] + [Object/Target] + [Body part or Tool] + [Relation] + [Temporal order]

Keep raw teacher text, AI text, reference annotations,
and research coding as separate immutable or auditable layers.

The web application should prepare tidy datasets for later statistical analysis.
Do not present inferential statistics as automated research conclusions.

Prioritize: research validity → data integrity → privacy → usability → visual polish.
```

## 2. 연구 규모 설정 규칙

- `participant_target (P)`, `research_video_count (N)`은 `studies` 테이블 설정값이다. **코드에 20, 5, 100, 4 같은 상수를 하드코딩하지 않는다.** 모든 목표치는 `P`, `N`, `ceil(P/N)`에서 파생한다.
- 순서그룹은 N개 순환 라틴방진으로 자동 생성한다. 그룹 g(1-based)의 position p 영상 = `V[((g-1)+(p-1)) mod N + 1]`.
- 참여자 수(P) 증원은 언제든 가능하다. **영상 편수·영상 집합·순서그룹 구조는 첫 본 관찰이 시작되면 잠긴다**(`studies.structure_locked_at`, DB 트리거가 강제). 잠금 해제 코드를 작성하지 않는다.
- 참여자마다 서로 다른 영상 부분집합을 배정하는 로직을 작성하지 않는다.

## 3. 기술 스택과 구조

- Next.js 16 App Router + TypeScript, Tailwind 4 + shadcn/ui, Supabase(Postgres/Auth/Private Storage/RLS), Zod 4, Vitest, Playwright, Vercel.
- Next 16 규칙: `params`/`searchParams`/`cookies()`/`headers()`는 async. 루트 미들웨어 파일은 `proxy.ts`(`export function proxy`, `proxyConfig`).
- 스키마는 `supabase/migrations/*.sql`이 정본이다(ORM 없음). 타입은 `npm run db:types`로 생성한 `types/database.ts`를 쓴다.
- 도메인 로직은 `lib/services/*`에 두고 Route Handler/Server Action은 얇게 유지한다.
- 참여자 API는 Route Handler(JSON, `sendBeacon` 호환), `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `Cache-Control: no-store`.
- 참여자 화면 번들에는 Supabase URL/키를 포함하지 않는다. 참여자는 자체 API만 호출한다.

## 4. 보안·무결성 규칙 (NON-NEGOTIABLE)

1. 영상 버킷은 private. signed URL은 서버 인가 후에만 발급하며 TTL은 짧게 유지한다. public URL·direct URL 금지.
2. `SUPABASE_SERVICE_ROLE_KEY`, `PARTICIPANT_SESSION_SECRET`, `CRON_SECRET`은 서버 전용이다. `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
3. 제출된 `observations` 행, `observation_events`, `audit_logs`, `participant_consents`, `study_settings`는 수정·삭제하지 않는다. 무효화는 `invalidated=true` + 새 `attempt_number`.
4. 모든 참여자 데이터 접근은 `observation.participant_id === session.participantId`를 서버에서 검증한다. 불일치는 404.
5. 타이머 기준은 서버 `started_at`이다. 클라이언트 시각을 신뢰하지 않는다.
6. 연구 영상을 외부 AI API로 자동 전송하는 코드를 작성하지 않는다(AI 기술문은 관리자가 수동 등록/CSV import).
7. 참여자 화면 문구에 `Precision`, `Recall`, `Hallucination`, `V01` 같은 내부 코드·지표를 노출하지 않는다. `npm run check:forbidden`이 검출한다.
8. 제3자 분석/추적 스크립트를 설치하지 않는다.

## 5. 작업 규칙

- 순수 로직(플레이어 상태머신, 타이머, 순서 균형, 텍스트 통계, 트리거)은 UI보다 먼저 테스트로 고정한다.
- `npm run check` (typecheck + lint + forbidden scan)가 통과해야 한다.
- 로컬 DB: `npm run db:start` → `npm run db:reset` → `npm run seed`.
- 커밋은 사용자가 요청할 때만 한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
