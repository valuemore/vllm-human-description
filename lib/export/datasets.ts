import "server-only";
import { getServiceClient, type ServiceClient } from "@/lib/db/service-client";
import { fromDbError } from "@/lib/errors";

/**
 * Export 데이터셋 레지스트리 (PRD §34). CSV/XLSX 공용. codebook.csv 는 이 정의에서 자동 생성된다.
 * 모든 분석 파일에 participant_code / video_code / order_group / presentation_order / observation_id 를 유지한다.
 */
export type ColumnType = "string" | "integer" | "number" | "boolean" | "timestamp" | "json" | "text";
export type Column = { key: string; header?: string; type: ColumnType; description: string; values?: string };
export type Row = Record<string, unknown>;
export type Dataset = {
  name: string;
  title: string;
  description: string;
  grain: string;
  columns: Column[];
  query: (sb: ServiceClient, studyId: string) => Promise<Row[]>;
};

const PAGE = 1000;
async function paged<T>(fetch: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetch(from, from + PAGE - 1);
    if (error) throw fromDbError(error);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const idCols: Column[] = [
  { key: "participant_code", type: "string", description: "참여자 연구 코드 (T01…)" },
  { key: "video_code", type: "string", description: "영상 코드 (V01…)" },
  { key: "order_group", type: "string", description: "순서그룹 (O1…)" },
  { key: "presentation_order", type: "integer", description: "제시순서 (1..N)" },
  { key: "observation_id", type: "string", description: "관찰 UUID" },
];

export const DATASETS: Dataset[] = [
  {
    name: "participants",
    title: "참여자",
    description: "참여자 상태·배정·진행 (PIN 해시 제외)",
    grain: "1행 = 참여자",
    columns: [
      { key: "participant_code", type: "string", description: "참여자 코드" },
      { key: "order_group", type: "string", description: "순서그룹" },
      { key: "status", type: "string", description: "상태", values: "invited|consented|onboarding|practice_completed|in_progress|completed|withdrawn|technical_issue" },
      { key: "is_valid", type: "boolean", description: "유효 참여자 (탈락/기술문제 제외)" },
      { key: "completed_count", type: "integer", description: "제출된 유효 본 관찰 수" },
      { key: "target_count", type: "integer", description: "배정 영상 수 (N)" },
      { key: "has_consent", type: "boolean", description: "동의 완료" },
      { key: "has_demographics", type: "boolean", description: "기본정보 입력" },
      { key: "guide_acknowledged_at", type: "timestamp", description: "안내 확인 시각" },
      { key: "practice_completed_at", type: "timestamp", description: "연습 완료 시각" },
      { key: "started_at", type: "timestamp", description: "본 관찰 시작 시각" },
      { key: "main_deadline_at", type: "timestamp", description: "전체 제한시간 마감 (첫 본 관찰 시작 + total_time_limit_seconds)" },
      { key: "completed_at", type: "timestamp", description: "완료 시각" },
      { key: "device_category", type: "string", description: "기기 분류", values: "desktop|mobile|tablet|unknown" },
      { key: "browser_category", type: "string", description: "브라우저 분류" },
      { key: "replaced_participant_id", type: "string", description: "대체한 탈락 참여자 UUID" },
      { key: "created_at", type: "timestamp", description: "생성 시각" },
    ],
    query: async (sb, s) => paged((f, t) => sb.from("v_participant_progress").select("*").eq("study_id", s).order("participant_code").range(f, t)),
  },
  {
    name: "participant_demographics",
    title: "참여자 기본정보",
    description: "교사 경력·담당 연령·기록 빈도·영상관찰/생성형 AI 경험 (PRD §16)",
    grain: "1행 = 참여자",
    columns: [
      { key: "participant_code", type: "string", description: "참여자 코드" },
      { key: "teaching_experience_years", type: "integer", description: "교사 경력 (년)" },
      { key: "teaching_experience_months", type: "integer", description: "교사 경력 (개월, 0-11)" },
      { key: "current_child_age_group", type: "string", description: "현재 담당 반 연령", values: "age_0|age_1|age_2|age_3|age_4|age_5|mixed|not_homeroom" },
      { key: "observation_record_frequency", type: "string", description: "관찰기록 작성 빈도", values: "daily|several_per_week|weekly|several_per_month|monthly_or_less" },
      { key: "video_observation_experience", type: "string", description: "영상 관찰기록 경험", values: "none|few_times|regular" },
      { key: "generative_ai_experience", type: "string", description: "생성형 AI 사용 경험", values: "never|tried|sometimes|often" },
    ],
    query: async (sb, s) => {
      const rows = await paged((f, t) => sb.from("participant_demographics").select("*, participant:participants!inner(participant_code, study_id)").eq("participant.study_id", s).range(f, t));
      return rows.map((r) => ({ ...r, participant_code: (r.participant as { participant_code: string }).participant_code })).sort((a, b) => String(a.participant_code).localeCompare(String(b.participant_code)));
    },
  },
  {
    name: "videos",
    title: "영상",
    description: "연구영상 메타데이터 (storage 경로 제외)",
    grain: "1행 = 영상",
    columns: [
      { key: "video_code", type: "string", description: "영상 코드" },
      { key: "kind", type: "string", description: "구분", values: "research|practice" },
      { key: "title_admin", type: "string", description: "관리자용 제목" },
      { key: "duration_ms", type: "integer", description: "길이 (ms)" },
      { key: "width", type: "integer", description: "가로 해상도" },
      { key: "height", type: "integer", description: "세로 해상도" },
      { key: "has_audio", type: "boolean", description: "오디오 포함" },
      { key: "age_group", type: "string", description: "영유아 연령대" },
      { key: "activity_type", type: "string", description: "활동유형" },
      { key: "complexity_level", type: "string", description: "복잡성 수준" },
      { key: "actor_count", type: "integer", description: "등장인물 수" },
      { key: "object_count", type: "integer", description: "주요 사물 수" },
      { key: "active", type: "boolean", description: "활성" },
      { key: "sort_order", type: "integer", description: "정렬 순서" },
    ],
    query: async (sb, s) => (await paged((f, t) => sb.from("videos").select("*").eq("study_id", s).order("kind").order("sort_order").range(f, t))).map((v) => ({ ...v, video_code: v.code })),
  },
  {
    name: "order_groups",
    title: "순서그룹",
    description: "그룹별 제시순서 (pos1..posN)",
    grain: "1행 = 순서그룹",
    columns: [
      { key: "order_group", type: "string", description: "순서그룹 코드" },
      { key: "group_index", type: "integer", description: "그룹 번호" },
      { key: "target_participants", type: "integer", description: "목표 인원 ceil(P/N)" },
      { key: "assigned_valid", type: "integer", description: "유효 배정 인원" },
      { key: "completed_valid", type: "integer", description: "완료 유효 인원" },
      { key: "sequence", type: "string", description: "제시순서 (V01 → V02 …)" },
      { key: "generation", type: "integer", description: "재생성 세대" },
    ],
    query: async (sb, s) => (await paged((f, t) => sb.from("v_order_group_balance").select("*").eq("study_id", s).order("group_index").range(f, t))).map((g) => ({ ...g, order_group: g.code })),
  },
  {
    name: "assignments",
    title: "배정표",
    description: "참여자 × 영상 × 제시순서 정본",
    grain: "1행 = 참여자 × 영상",
    columns: [
      { key: "participant_code", type: "string", description: "참여자 코드" },
      { key: "order_group", type: "string", description: "순서그룹" },
      { key: "video_code", type: "string", description: "영상 코드" },
      { key: "presentation_order", type: "integer", description: "제시순서" },
    ],
    query: async (sb, s) => {
      const rows = await paged((f, t) =>
        sb.from("participant_order_assignments").select("presentation_order, participant:participants(participant_code), video:videos(code), grp:order_groups(code)").eq("study_id", s).range(f, t),
      );
      return rows
        .map((r) => ({
          participant_code: (r.participant as { participant_code: string }).participant_code,
          order_group: (r.grp as { code: string }).code,
          video_code: (r.video as { code: string }).code,
          presentation_order: r.presentation_order,
        }))
        .sort((a, b) => a.participant_code.localeCompare(b.participant_code) || a.presentation_order - b.presentation_order);
    },
  },
  {
    name: "teacher_observations",
    title: "교사 관찰기록 (전체 attempt)",
    description: "제출·무효화 포함 모든 본 관찰 attempt. 원문 텍스트 포함",
    grain: "1행 = 관찰 attempt",
    columns: [
      ...idCols,
      { key: "attempt_number", type: "integer", description: "시도 번호" },
      { key: "status", type: "string", description: "상태", values: "pending|in_progress|submitted|invalidated" },
      { key: "is_valid_record", type: "boolean", description: "유효 기록 (제출·무효화 아님·유효 참여자)" },
      { key: "started_at", type: "timestamp", description: "타이머 시작(첫 재생)" },
      { key: "first_watch_completed_at", type: "timestamp", description: "첫 시청 완료" },
      { key: "submitted_at", type: "timestamp", description: "제출 시각" },
      { key: "wall_elapsed_seconds", type: "number", description: "시작→제출 경과 (초)" },
      { key: "effective_elapsed_seconds", type: "number", description: "wall − buffering" },
      { key: "first_watch_seconds", type: "number", description: "첫 시청 소요" },
      { key: "buffering_seconds", type: "number", description: "buffering 합계" },
      { key: "replay_count", type: "integer", description: "재시청 횟수" },
      { key: "pause_count", type: "integer", description: "일시정지 횟수" },
      { key: "seek_count", type: "integer", description: "seek 횟수" },
      { key: "page_hidden_count", type: "integer", description: "페이지 이탈 횟수" },
      { key: "page_hidden_seconds", type: "number", description: "페이지 이탈 시간" },
      { key: "submission_type", type: "string", description: "제출 유형", values: "manual|timeout" },
      { key: "timed_out", type: "boolean", description: "timeout 여부" },
      { key: "main_deadline_at", type: "timestamp", description: "참여자 전체 제한시간 마감" },
      { key: "started_after_total_deadline", type: "boolean", description: "전체 제한시간이 지난 뒤 시작한 관찰 (시간 제한 없이 진행)" },
      { key: "seconds_since_participant_start", type: "number", description: "참여자 본 관찰 시작 → 이 관찰 시작 (초)" },
      { key: "observation_text", type: "text", description: "교사 원문 (불변)" },
      { key: "character_count", type: "integer", description: "글자 수 (공백 제외)" },
      { key: "word_count", type: "integer", description: "단어 수" },
      { key: "sentence_count", type: "integer", description: "문장 수" },
      { key: "device_category", type: "string", description: "기기" },
      { key: "browser_category", type: "string", description: "브라우저" },
      { key: "technical_issue", type: "boolean", description: "기술 오류 플래그" },
      { key: "invalidated", type: "boolean", description: "무효화" },
      { key: "invalidated_reason", type: "string", description: "무효화 사유" },
    ],
    query: async (sb, s) => {
      const rows = await paged((f, t) => sb.from("v_research_master").select("*").eq("study_id", s).order("participant_code").order("presentation_order").order("attempt_number").range(f, t));
      const pending = await paged((f, t) => sb.from("v_observation_metrics").select("*").eq("study_id", s).eq("is_practice", false).in("status", ["pending", "in_progress"]).range(f, t));
      return [...rows, ...pending.map((p) => ({ ...p, is_valid_record: false, main_deadline_at: p.total_deadline_at, seconds_since_participant_start: null }))];
    },
  },
  {
    name: "interaction_events",
    title: "상호작용 이벤트",
    description: "모든 재생/페이지/네트워크/저장 이벤트 원자료 (연습 포함)",
    grain: "1행 = 이벤트",
    columns: [
      { key: "id", type: "integer", description: "이벤트 id" },
      ...idCols,
      { key: "attempt_number", type: "integer", description: "시도 번호" },
      { key: "is_practice", type: "boolean", description: "연습 관찰" },
      { key: "event_type", type: "string", description: "이벤트 유형 (PRD §14)" },
      { key: "event_timestamp", type: "timestamp", description: "서버 보정 시각" },
      { key: "client_timestamp", type: "timestamp", description: "클라이언트 시각" },
      { key: "seconds_since_start", type: "number", description: "started_at 기준 경과 (초)" },
      { key: "video_current_time_ms", type: "integer", description: "영상 위치 (ms)" },
      { key: "client_session_id", type: "string", description: "페이지 로드 세션" },
      { key: "seq", type: "integer", description: "세션 내 순번" },
      { key: "metadata_json", type: "json", description: "부가 정보" },
    ],
    query: async (sb, s) => {
      const obs = await paged((f, t) => sb.from("v_observation_metrics").select("observation_id, participant_code, video_code, order_group, presentation_order, attempt_number, is_practice, started_at").eq("study_id", s).range(f, t));
      const byId = new Map(obs.map((o) => [o.observation_id, o]));
      const ids = [...byId.keys()].filter((x): x is string => !!x);
      const out: Row[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const evs = await paged((f, t) => sb.from("observation_events").select("*").in("observation_id", chunk).order("observation_id").order("event_timestamp").order("id").range(f, t));
        for (const e of evs) {
          const o = byId.get(e.observation_id)!;
          out.push({
            id: e.id, observation_id: e.observation_id, participant_code: o.participant_code, video_code: o.video_code, order_group: o.order_group,
            presentation_order: o.presentation_order, attempt_number: o.attempt_number, is_practice: o.is_practice, event_type: e.event_type,
            event_timestamp: e.event_timestamp, client_timestamp: e.client_timestamp,
            seconds_since_start: o.started_at ? Math.round((new Date(e.event_timestamp).getTime() - new Date(o.started_at).getTime())) / 1000 : null,
            video_current_time_ms: e.video_current_time_ms, client_session_id: e.client_session_id, seq: e.seq, metadata_json: e.metadata_json,
          });
        }
      }
      return out;
    },
  },
  {
    name: "ai_outputs",
    title: "AI 기술문",
    description: "생성형 AI 기술문 (run 별, prompt version 연결)",
    grain: "1행 = AI run",
    columns: [
      { key: "ai_run_id", type: "string", description: "run UUID" },
      { key: "video_code", type: "string", description: "영상 코드" },
      { key: "run_number", type: "integer", description: "반복 번호" },
      { key: "provider", type: "string", description: "제공자" },
      { key: "model_name", type: "string", description: "모델" },
      { key: "model_version_or_snapshot", type: "string", description: "모델 버전" },
      { key: "prompt_code", type: "string", description: "프롬프트 코드" },
      { key: "prompt_version", type: "integer", description: "프롬프트 버전" },
      { key: "generated_text", type: "text", description: "생성 텍스트 (불변)" },
      { key: "generated_at", type: "timestamp", description: "생성 시각" },
      { key: "character_count", type: "integer", description: "글자 수" },
      { key: "word_count", type: "integer", description: "단어 수" },
      { key: "sentence_count", type: "integer", description: "문장 수" },
      { key: "generation_settings_json", type: "json", description: "생성 설정" },
      { key: "superseded_by", type: "string", description: "대체 run UUID" },
      { key: "notes", type: "string", description: "메모" },
    ],
    query: async (sb, s) => {
      const rows = await paged((f, t) => sb.from("ai_runs").select("*, video:videos(code), prompt:ai_prompts(prompt_code, version)").eq("study_id", s).range(f, t));
      return rows
        .map((r) => ({ ...r, ai_run_id: r.id, video_code: (r.video as { code: string }).code, prompt_code: (r.prompt as { prompt_code: string }).prompt_code, prompt_version: (r.prompt as { version: number }).version }))
        .sort((a, b) => a.video_code.localeCompare(b.video_code) || a.run_number - b.run_number);
    },
  },
  {
    name: "reference_events",
    title: "Reference Events",
    description: "기준 행동단위 (행위자·행동·대상·신체/도구·관계·시간순서)",
    grain: "1행 = Reference Event",
    columns: [
      { key: "reference_event_id", type: "string", description: "UUID" },
      { key: "video_code", type: "string", description: "영상 코드" },
      { key: "event_code", type: "string", description: "E01…" },
      { key: "event_order", type: "integer", description: "순서" },
      { key: "start_ms", type: "integer", description: "시작 (ms)" },
      { key: "end_ms", type: "integer", description: "종료 (ms)" },
      { key: "actor", type: "string", description: "행위자" },
      { key: "action", type: "string", description: "행동" },
      { key: "object", type: "string", description: "대상" },
      { key: "body_part_or_tool", type: "string", description: "신체/도구" },
      { key: "relation", type: "string", description: "관계" },
      { key: "previous_event_id", type: "string", description: "이전 Event UUID" },
      { key: "temporal_relation", type: "string", description: "시간적 순서" },
      { key: "reference_sentence", type: "text", description: "기준 행동문" },
      { key: "behavior_category", type: "string", description: "행동 유형" },
      { key: "is_consensus", type: "boolean", description: "합의 기준" },
      { key: "notes", type: "string", description: "메모" },
    ],
    query: async (sb, s) => {
      const rows = await paged((f, t) => sb.from("reference_events").select("*, video:videos(code)").eq("study_id", s).is("deleted_at", null).range(f, t));
      return rows.map((r) => ({ ...r, reference_event_id: r.id, video_code: (r.video as { code: string }).code })).sort((a, b) => a.video_code.localeCompare(b.video_code) || a.event_order - b.event_order);
    },
  },
  {
    name: "response_claims",
    title: "Claims",
    description: "교사/AI 기술문을 의미 단위로 분할한 Claim",
    grain: "1행 = Claim",
    columns: [
      { key: "claim_id", type: "string", description: "UUID" },
      { key: "coding_session_id", type: "string", description: "코딩 세션" },
      { key: "source_type", type: "string", description: "출처", values: "teacher|ai" },
      { key: "source_record_id", type: "string", description: "observation_id 또는 ai_run_id" },
      { key: "participant_code", type: "string", description: "(teacher) 참여자" },
      { key: "video_code", type: "string", description: "영상 코드" },
      { key: "claim_order", type: "integer", description: "순서" },
      { key: "claim_text", type: "text", description: "Claim 텍스트" },
      { key: "char_start", type: "integer", description: "원문 시작 offset" },
      { key: "char_end", type: "integer", description: "원문 종료 offset" },
    ],
    query: async (sb, s) => {
      const rows = await paged((f, t) => sb.from("response_claims").select("*, session:coding_sessions!inner(study_id, video:videos(code))").eq("session.study_id", s).range(f, t));
      const obsIds = [...new Set(rows.filter((r) => r.source_type === "teacher").map((r) => r.source_record_id))];
      const codes = new Map<string, string>();
      for (let i = 0; i < obsIds.length; i += 100) {
        const { data } = await sb.from("v_observation_metrics").select("observation_id, participant_code").in("observation_id", obsIds.slice(i, i + 100));
        for (const o of data ?? []) if (o.observation_id) codes.set(o.observation_id, o.participant_code ?? "");
      }
      return rows.map((r) => ({ ...r, claim_id: r.id, video_code: ((r.session as { video: { code: string } }).video).code, participant_code: codes.get(r.source_record_id) ?? null }));
    },
  },
  {
    name: "claim_codings",
    title: "Claim Codings",
    description: "Claim ↔ Reference Event 대응 및 정확성 코딩",
    grain: "1행 = Claim × coder",
    columns: [
      { key: "claim_coding_id", type: "string", description: "UUID" },
      { key: "claim_id", type: "string", description: "Claim UUID" },
      { key: "coder_id", type: "string", description: "코더 UUID" },
      { key: "matched_reference_event_id", type: "string", description: "대응 Reference Event" },
      { key: "matched_event_code", type: "string", description: "대응 Event 코드" },
      { key: "support_type", type: "string", description: "지지 유형", values: "observed|inference_supported|inference_unsupported|hallucination|unclear" },
      { key: "actor_accuracy", type: "string", description: "행위자 정확성", values: "correct|partial|incorrect|not_applicable" },
      { key: "action_accuracy", type: "string", description: "행동 정확성" },
      { key: "object_accuracy", type: "string", description: "대상 정확성" },
      { key: "temporal_accuracy", type: "string", description: "시간 정확성" },
      { key: "granularity_score", type: "integer", description: "구체성 1(포괄)-3(구체)" },
      { key: "notes", type: "string", description: "코더 메모" },
    ],
    query: async (sb, s) => {
      const rows = await paged((f, t) => sb.from("claim_codings").select("*, claim:response_claims!inner(coding_session_id, session:coding_sessions!inner(study_id)), ref:reference_events(event_code)").eq("claim.session.study_id", s).range(f, t));
      return rows.map((r) => ({ ...r, claim_coding_id: r.id, matched_event_code: (r.ref as { event_code: string } | null)?.event_code ?? null }));
    },
  },
  {
    name: "analysis_summary",
    title: "기술통계 요약",
    description: "전체/참여자/영상/제시순서별 평균 (PRD §32.1)",
    grain: "1행 = 차원 × 키",
    columns: [
      { key: "dimension", type: "string", description: "차원", values: "overall|participant|video|presentation_order" },
      { key: "key", type: "string", description: "키 값" },
      { key: "n", type: "integer", description: "표본 수" },
      { key: "avg_wall_seconds", type: "number", description: "평균 wall 시간" },
      { key: "avg_effective_seconds", type: "number", description: "평균 effective 시간" },
      { key: "avg_first_watch_seconds", type: "number", description: "평균 첫 시청" },
      { key: "avg_characters", type: "number", description: "평균 글자" },
      { key: "avg_words", type: "number", description: "평균 단어" },
      { key: "avg_sentences", type: "number", description: "평균 문장" },
      { key: "avg_replay", type: "number", description: "평균 replay" },
      { key: "avg_pause", type: "number", description: "평균 pause" },
      { key: "avg_seek", type: "number", description: "평균 seek" },
      { key: "timeout_rate", type: "number", description: "timeout 비율" },
    ],
    query: async (sb, s) => paged((f, t) => sb.from("v_analysis_summary").select("*").eq("study_id", s).order("dimension").order("key").range(f, t)),
  },
  {
    name: "research_master",
    title: "Research Master",
    description: "1행 = 교사 × 영상 관찰 (제출·무효화 포함, is_valid_record 로 필터). mixed-effects 분석용 tidy dataset",
    grain: "1행 = 교사 × 영상 attempt",
    columns: [
      ...idCols,
      { key: "attempt_number", type: "integer", description: "시도 번호" },
      { key: "is_valid_record", type: "boolean", description: "분석 포함 여부" },
      { key: "participant_valid", type: "boolean", description: "참여자 유효" },
      { key: "started_at", type: "timestamp", description: "시작" },
      { key: "submitted_at", type: "timestamp", description: "제출" },
      { key: "wall_elapsed_seconds", type: "number", description: "wall" },
      { key: "effective_elapsed_seconds", type: "number", description: "effective" },
      { key: "first_watch_seconds", type: "number", description: "첫 시청" },
      { key: "buffering_seconds", type: "number", description: "buffering" },
      { key: "replay_count", type: "integer", description: "replay" },
      { key: "pause_count", type: "integer", description: "pause" },
      { key: "seek_count", type: "integer", description: "seek" },
      { key: "submission_type", type: "string", description: "manual|timeout" },
      { key: "timed_out", type: "boolean", description: "timeout 여부" },
      { key: "started_after_total_deadline", type: "boolean", description: "전체 제한시간 이후 시작 (시간 제한 없이 진행)" },
      { key: "seconds_since_participant_start", type: "number", description: "참여자 본 관찰 시작 → 이 관찰 시작 (초)" },
      { key: "observation_text", type: "text", description: "원문" },
      { key: "character_count", type: "integer", description: "글자 수" },
      { key: "word_count", type: "integer", description: "단어 수" },
      { key: "sentence_count", type: "integer", description: "문장 수" },
      { key: "device_category", type: "string", description: "기기" },
      { key: "browser_category", type: "string", description: "브라우저" },
      { key: "technical_issue", type: "boolean", description: "기술 오류" },
      { key: "invalidated", type: "boolean", description: "무효화" },
      { key: "invalidated_reason", type: "string", description: "무효화 사유" },
    ],
    query: async (sb, s) => paged((f, t) => sb.from("v_research_master").select("*").eq("study_id", s).order("participant_code").order("presentation_order").order("attempt_number").range(f, t)),
  },
];

export const CODEBOOK: Dataset = {
  name: "codebook",
  title: "Codebook",
  description: "모든 export 파일의 변수 정의",
  grain: "1행 = 파일 × 변수",
  columns: [
    { key: "file", type: "string", description: "파일 이름" },
    { key: "grain", type: "string", description: "행 단위" },
    { key: "variable", type: "string", description: "변수명" },
    { key: "type", type: "string", description: "자료형" },
    { key: "description", type: "string", description: "설명" },
    { key: "values", type: "string", description: "허용 값" },
  ],
  query: async () =>
    DATASETS.flatMap((d) => d.columns.map((c) => ({ file: `${d.name}.csv`, grain: d.grain, variable: c.key, type: c.type, description: c.description, values: c.values ?? "" }))),
};

export const ALL_DATASETS = [...DATASETS, CODEBOOK];

export function getDataset(name: string): Dataset | null {
  return ALL_DATASETS.find((d) => d.name === name) ?? null;
}

export async function runDataset(dataset: Dataset, studyId: string): Promise<Row[]> {
  return dataset.query(getServiceClient(), studyId);
}
