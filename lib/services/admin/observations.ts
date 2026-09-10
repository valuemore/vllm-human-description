import "server-only";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError, fromDbError } from "@/lib/errors";

export type ObservationFilters = {
  participant?: string;
  video?: string;
  group?: string;
  order?: number;
  submission?: "manual" | "timeout";
  validity?: "valid" | "invalid";
  technical?: boolean;
  status?: "pending" | "in_progress" | "submitted" | "invalidated";
  practice?: boolean;
};

export async function listObservations(studyId: string, f: ObservationFilters = {}) {
  let q = getServiceClient().from("v_observation_metrics").select("*").eq("study_id", studyId).eq("is_practice", f.practice ?? false);
  if (f.participant) q = q.eq("participant_code", f.participant.toUpperCase());
  if (f.video) q = q.eq("video_code", f.video.toUpperCase());
  if (f.group) q = q.eq("order_group", f.group.toUpperCase());
  if (f.order) q = q.eq("presentation_order", f.order);
  if (f.submission) q = q.eq("submission_type", f.submission);
  if (f.validity === "valid") q = q.eq("invalidated", false).eq("status", "submitted");
  if (f.validity === "invalid") q = q.eq("invalidated", true);
  if (f.technical) q = q.eq("technical_issue", true);
  if (f.status) q = q.eq("status", f.status);
  const { data, error } = await q.order("participant_code").order("presentation_order").order("attempt_number");
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function getObservationDetail(observationId: string) {
  const sb = getServiceClient();
  const [metrics, row, events] = await Promise.all([
    sb.from("v_observation_metrics").select("*").eq("observation_id", observationId).maybeSingle(),
    sb.from("observations").select("observation_text, draft_text, draft_revision, draft_saved_at, client_info, invalidated_by, invalidated_at").eq("id", observationId).maybeSingle(),
    sb.from("observation_events").select("id, event_type, event_timestamp, client_timestamp, seq, video_current_time_ms, metadata_json").eq("observation_id", observationId).order("event_timestamp").order("id"),
  ]);
  if (metrics.error) throw fromDbError(metrics.error);
  if (!metrics.data || !row.data) throw new AppError("NOT_FOUND", "관찰기록을 찾을 수 없습니다");
  const evs = events.data ?? [];
  const count = (t: string) => evs.filter((e) => e.event_type === t).length;
  const summary = {
    plays: count("video_play"),
    replays: evs.filter((e) => e.event_type === "video_play" && (e.metadata_json as { is_replay?: boolean })?.is_replay).length,
    pauses: count("video_pause"),
    seeks: count("video_seek"),
    buffers: count("video_buffer_start"),
    hidden: count("page_hidden"),
    offline: count("network_offline"),
    blocked: count("first_watch_blocked_action"),
    restarts: count("first_watch_restarted"),
    errors: count("video_error"),
    drafts: count("draft_saved"),
  };
  return { metrics: metrics.data, row: row.data, events: evs, summary };
}

export async function invalidateObservation(observationId: string, reason: string, adminId: string, createRetry: boolean) {
  const { data, error } = await getServiceClient().rpc("invalidate_and_retry", { p_observation_id: observationId, p_reason: reason, p_admin_id: adminId, p_create_retry: createRetry });
  if (error) throw fromDbError(error);
  return data;
}
