import "server-only";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError, fromDbError } from "@/lib/errors";
import { assertOwnership, type ParticipantContext } from "@/lib/auth/participant";
import { loadParticipantSnapshot } from "@/lib/participant/snapshot";
import { activeMainObservations, resolveNextStep, type ParticipantStep } from "@/lib/participant/resolveNextStep";
import { TIMEOUT_TOLERANCE_SECONDS } from "@/lib/timer";
import type { Database, Json } from "@/types/database";
import type { EventBatchInput } from "@/lib/validation/observation";

type ObservationRow = Database["public"]["Tables"]["observations"]["Row"];
type VideoRow = Database["public"]["Tables"]["videos"]["Row"];

export type TimerSnapshot = {
  startedAt: string | null;
  maxSeconds: number;
  timerMode: "wall_time" | "effective_time";
  wallElapsedSeconds: number;
  bufferingSeconds: number;
  effectiveElapsedSeconds: number;
  remainingSeconds: number;
  expired: boolean;
};

export type ObservationSnapshot = {
  id: string;
  isPractice: boolean;
  order: number | null;
  totalCount: number;
  completedCount: number;
  status: ObservationRow["status"];
  startedAt: string | null;
  firstWatchCompletedAt: string | null;
  submittedAt: string | null;
  draftText: string;
  draftRevision: number;
  video: { durationMs: number | null; hasAudio: boolean; width: number | null; height: number | null };
  timer: TimerSnapshot;
  settings: { watermarkEnabled: boolean; replayEnabled: boolean; participantCode: string };
  serverNow: string;
};

const MAX_BACKDATE_MS = 10_000;

async function loadOwned(ctx: ParticipantContext, id: string): Promise<ObservationRow & { video: VideoRow }> {
  const sb = getServiceClient();
  const { data } = await sb.from("observations").select("*, video:videos(*)").eq("id", id).maybeSingle();
  assertOwnership(ctx, data);
  const row = data!;
  if (!row.video) throw new AppError("NOT_FOUND", "영상을 찾을 수 없습니다");
  return { ...row, video: row.video as VideoRow };
}

async function timerState(id: string): Promise<TimerSnapshot> {
  const { data, error } = await getServiceClient().rpc("observation_timer_state", { p_observation_id: id });
  if (error || !data?.[0]) throw fromDbError(error);
  const t = data[0];
  return {
    startedAt: t.started_at,
    maxSeconds: t.max_seconds,
    timerMode: t.timer_mode,
    wallElapsedSeconds: Number(t.wall_elapsed_seconds),
    bufferingSeconds: Number(t.buffering_seconds),
    effectiveElapsedSeconds: Number(t.effective_elapsed_seconds),
    remainingSeconds: Number(t.remaining_seconds),
    expired: t.expired,
  };
}

/** 만료된 진행 중 관찰을 timeout 제출로 마감하고 최신 행을 반환 (lazy finalize) */
async function finalizeIfExpired(row: ObservationRow): Promise<{ row: ObservationRow; timer: TimerSnapshot }> {
  const timer = await timerState(row.id);
  if (row.status === "in_progress" && timer.expired) {
    const { data, error } = await getServiceClient().rpc("submit_observation", { p_observation_id: row.id, p_type: "timeout" });
    if (error) throw fromDbError(error);
    return { row: data as ObservationRow, timer: await timerState(row.id) };
  }
  return { row, timer };
}

async function progress(ctx: ParticipantContext) {
  const snapshot = await loadParticipantSnapshot(ctx);
  const active = activeMainObservations(snapshot.main);
  return { snapshot, totalCount: active.length, completedCount: active.filter((o) => o.status === "submitted").length };
}

export async function getObservationSnapshot(ctx: ParticipantContext, id: string): Promise<ObservationSnapshot> {
  const loaded = await loadOwned(ctx, id);
  const { row, timer } = await finalizeIfExpired(loaded);
  const { totalCount, completedCount } = await progress(ctx);
  return {
    id: row.id,
    isPractice: row.is_practice,
    order: row.presentation_order,
    totalCount,
    completedCount,
    status: row.status,
    startedAt: row.started_at,
    firstWatchCompletedAt: row.first_watch_completed_at,
    submittedAt: row.submitted_at,
    draftText: row.draft_text,
    draftRevision: row.draft_revision,
    video: { durationMs: loaded.video.duration_ms, hasAudio: loaded.video.has_audio, width: loaded.video.width, height: loaded.video.height },
    timer,
    settings: { watermarkEnabled: ctx.study.watermark_enabled, replayEnabled: ctx.study.replay_enabled, participantCode: ctx.participant.participant_code },
    serverNow: new Date().toISOString(),
  };
}

/** 이 관찰을 지금 열 수 있는지 (순서 강제, 상태) */
async function assertOpenable(ctx: ParticipantContext, row: ObservationRow) {
  if (row.invalidated) throw new AppError("OBSERVATION_CLOSED", "무효화된 관찰입니다");
  if (row.status === "submitted") throw new AppError("ALREADY_SUBMITTED", "이미 제출된 관찰입니다");
  const { snapshot } = await progress(ctx);
  const step = resolveNextStep(snapshot);
  if (row.is_practice) {
    if (step.step !== "practice" || step.observationId !== row.id) throw new AppError("STEP_NOT_ALLOWED", "지금은 연습 관찰을 진행할 수 없습니다");
    return;
  }
  const allowed =
    (step.step === "observation" && step.observationId === row.id) || (step.step === "study_hub" && step.nextObservationId === row.id);
  if (!allowed) throw new AppError("ORDER_VIOLATION", "지정된 순서의 관찰만 진행할 수 있습니다");
}

export async function startObservation(ctx: ParticipantContext, id: string, clientElapsedMs: number) {
  const loaded = await loadOwned(ctx, id);
  if (loaded.started_at) {
    const { row, timer } = await finalizeIfExpired(loaded);
    if (row.status === "submitted") throw new AppError("TIMED_OUT", "제한시간이 끝나 제출되었습니다");
    return { startedAt: row.started_at!, deadlineAt: row.deadline_at, timer, serverNow: new Date().toISOString() };
  }
  await assertOpenable(ctx, loaded);
  const now = Date.now();
  const startedAt = new Date(now - Math.min(Math.max(clientElapsedMs, 0), MAX_BACKDATE_MS));
  const sb = getServiceClient();
  const { data, error } = await sb.rpc("start_observation", { p_observation_id: id, p_started_at: startedAt.toISOString() });
  if (error) throw fromDbError(error);
  const row = data as ObservationRow;
  await sb.rpc("record_server_event", {
    p_observation_id: id,
    p_type: "video_first_play_started",
    p_metadata: { client_elapsed_ms_since_play: clientElapsedMs },
    p_at: row.started_at!,
    p_video_ms: 0,
  });
  return { startedAt: row.started_at!, deadlineAt: row.deadline_at, timer: await timerState(id), serverNow: new Date().toISOString() };
}

const FIRST_WATCH_TOLERANCE_MS = 2_000;

export async function completeFirstWatch(ctx: ParticipantContext, id: string, maxWatchedMs: number) {
  const loaded = await loadOwned(ctx, id);
  const { row, timer } = await finalizeIfExpired(loaded);
  if (row.status === "submitted") throw new AppError("TIMED_OUT", "제한시간이 끝나 제출되었습니다");
  if (!row.started_at) throw new AppError("NOT_STARTED", "시청이 시작되지 않았습니다");
  if (row.first_watch_completed_at) return { accepted: true, firstWatchCompletedAt: row.first_watch_completed_at, timer, serverNow: new Date().toISOString() };

  const durationMs = loaded.video.duration_ms ?? maxWatchedMs;
  const elapsedMs = timer.effectiveElapsedSeconds * 1000;
  const accepted = elapsedMs + FIRST_WATCH_TOLERANCE_MS >= durationMs && maxWatchedMs + 500 >= durationMs;
  if (!accepted) {
    await getServiceClient().rpc("record_server_event", {
      p_observation_id: id,
      p_type: "first_watch_restarted",
      p_metadata: { reason: "server_rejected", elapsed_ms: Math.round(elapsedMs), max_watched_ms: maxWatchedMs, duration_ms: durationMs },
    });
    return { accepted: false, reason: "server_rejected" as const, timer, serverNow: new Date().toISOString() };
  }
  const { data, error } = await getServiceClient().rpc("complete_first_watch", { p_observation_id: id, p_max_watched_ms: maxWatchedMs });
  if (error) throw fromDbError(error);
  const updated = data as ObservationRow;
  return { accepted: true, firstWatchCompletedAt: updated.first_watch_completed_at!, timer: await timerState(id), serverNow: new Date().toISOString() };
}

export async function saveDraft(ctx: ParticipantContext, id: string, text: string, revision: number) {
  const loaded = await loadOwned(ctx, id);
  const { row, timer } = await finalizeIfExpired(loaded);
  if (row.status === "submitted") throw new AppError("TIMED_OUT", "제한시간이 끝나 제출되었습니다", { submissionType: row.submission_type });
  if (!row.first_watch_completed_at) throw new AppError("FIRST_WATCH_REQUIRED", "첫 시청이 끝난 뒤 기록할 수 있습니다");
  const { data, error } = await getServiceClient().rpc("save_observation_draft", { p_observation_id: id, p_text: text, p_revision: revision });
  if (error) throw fromDbError(error);
  return { savedRevision: data as number, timer, serverNow: new Date().toISOString() };
}

export type SubmitResult = { status: "submitted"; submissionType: "manual" | "timeout"; next: ParticipantStep; serverNow: string };

export async function submitObservation(
  ctx: ParticipantContext,
  id: string,
  input: { submissionType: "manual" | "timeout"; text?: string; revision?: number },
): Promise<SubmitResult> {
  const loaded = await loadOwned(ctx, id);
  const { row, timer } = await finalizeIfExpired(loaded);
  const sb = getServiceClient();

  if (row.status !== "submitted") {
    if (!row.started_at) throw new AppError("NOT_STARTED", "시청이 시작되지 않았습니다");
    // 제출 직전 최종 초안 반영 (revision 이 더 크면)
    if (input.text !== undefined && input.revision !== undefined && row.first_watch_completed_at) {
      await sb.rpc("save_observation_draft", { p_observation_id: id, p_text: input.text, p_revision: input.revision });
    }
    if (input.submissionType === "timeout") {
      if (timer.remainingSeconds > TIMEOUT_TOLERANCE_SECONDS) {
        throw new AppError("TOO_EARLY_FOR_TIMEOUT", "아직 시간이 남아 있습니다", { remainingSeconds: timer.remainingSeconds });
      }
    } else if (!row.first_watch_completed_at) {
      throw new AppError("FIRST_WATCH_REQUIRED", "첫 시청이 끝난 뒤 제출할 수 있습니다");
    }
    const { error } = await sb.rpc("submit_observation", { p_observation_id: id, p_type: input.submissionType });
    if (error) throw fromDbError(error);
  }
  const { data: fresh } = await sb.from("observations").select("submission_type").eq("id", id).single();
  const refreshed: ParticipantContext = { ...ctx, participant: { ...ctx.participant } };
  const next = resolveNextStep(await loadParticipantSnapshot(refreshed));
  return { status: "submitted", submissionType: (fresh?.submission_type ?? input.submissionType) as "manual" | "timeout", next, serverNow: new Date().toISOString() };
}

export async function getClock(ctx: ParticipantContext, id: string) {
  const loaded = await loadOwned(ctx, id);
  const { row, timer } = await finalizeIfExpired(loaded);
  return { status: row.status, submissionType: row.submission_type, timer, serverNow: new Date().toISOString() };
}

export async function ingestEvents(ctx: ParticipantContext, batch: EventBatchInput) {
  const loaded = await loadOwned(ctx, batch.observation_id);
  const { row, timer } = await finalizeIfExpired(loaded);
  const sb = getServiceClient();
  const { data, error } = await sb.rpc("ingest_observation_events", {
    p_observation_id: batch.observation_id,
    p_events: batch.events.map((e) => ({
      type: e.type,
      client_session_id: batch.client_session_id,
      seq: e.seq,
      client_timestamp: e.client_timestamp,
      video_current_time_ms: e.video_current_time_ms ?? null,
      metadata: e.metadata ?? {},
    })) as unknown as Json,
    p_client_now: batch.client_now,
  });
  if (error) {
    // 제출 후 30초가 지난 late event 는 조용히 버린다
    if (/OBSERVATION_CLOSED/.test(error.message)) return { inserted: 0, status: row.status, timer, serverNow: new Date().toISOString() };
    throw fromDbError(error);
  }
  // observation_started 이벤트의 기기 정보를 관찰 행에 반영
  const started = batch.events.find((e) => e.type === "observation_started");
  if (started?.metadata && row.status !== "submitted") {
    const m = started.metadata as Record<string, unknown>;
    await sb
      .from("observations")
      .update({
        device_category: typeof m.device_category === "string" ? m.device_category : row.device_category,
        browser_category: typeof m.browser_category === "string" ? m.browser_category : row.browser_category,
        client_info: m as Json,
      })
      .eq("id", row.id);
  }
  return { inserted: data as number, status: row.status, timer, serverNow: new Date().toISOString() };
}
