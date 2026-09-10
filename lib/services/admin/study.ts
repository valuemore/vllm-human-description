import "server-only";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError, fromDbError } from "@/lib/errors";
import type { Database, Json } from "@/types/database";

export type StudyRow = Database["public"]["Tables"]["studies"]["Row"];
const STUDY_COOKIE = "admin_study";

export async function listStudies() {
  const { data } = await getServiceClient().from("studies").select("id, code, name, status, created_at").order("created_at", { ascending: false });
  return data ?? [];
}

/** 관리자가 보고 있는 연구. 쿠키 → active 연구 → 최신 연구 순으로 결정 */
export async function getCurrentStudy(): Promise<StudyRow> {
  const sb = getServiceClient();
  const jar = await cookies();
  const wanted = jar.get(STUDY_COOKIE)?.value;
  if (wanted) {
    const { data } = await sb.from("studies").select("*").eq("id", wanted).maybeSingle();
    if (data) return data;
  }
  const { data: active } = await sb.from("studies").select("*").in("status", ["active", "pilot", "ready"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (active) return active;
  const { data: latest } = await sb.from("studies").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!latest) throw new AppError("NOT_FOUND", "등록된 연구가 없습니다. npm run seed 를 실행하세요.");
  return latest;
}

export async function setCurrentStudyCookie(studyId: string) {
  const jar = await cookies();
  jar.set({ name: STUDY_COOKIE, value: studyId, httpOnly: true, sameSite: "lax", path: "/admin" });
}

export async function getTargets(studyId: string) {
  const { data, error } = await getServiceClient().rpc("study_targets", { p_study_id: studyId });
  if (error || !data?.[0]) throw fromDbError(error);
  return data[0];
}

export async function getDashboard(studyId: string) {
  const sb = getServiceClient();
  const [kpi, videos, groups, checks, expired, recentIssues] = await Promise.all([
    sb.from("v_dashboard_kpi").select("*").eq("study_id", studyId).single(),
    sb.from("v_video_progress").select("*").eq("study_id", studyId).order("sort_order"),
    sb.from("v_order_group_balance").select("*").eq("study_id", studyId).order("group_index"),
    sb.from("v_order_balance_check").select("*").eq("study_id", studyId),
    sb.from("v_observation_metrics").select("observation_id, participant_code, video_code, presentation_order, remaining_seconds, started_at").eq("study_id", studyId).eq("status", "in_progress").order("started_at"),
    sb.from("v_participant_progress").select("participant_id, participant_code, order_group, status, has_technical_issue").eq("study_id", studyId).eq("has_technical_issue", true).order("participant_code"),
  ]);
  if (kpi.error) throw fromDbError(kpi.error);
  return { kpi: kpi.data, videos: videos.data ?? [], groups: groups.data ?? [], checks: checks.data ?? [], inProgress: expired.data ?? [], issues: recentIssues.data ?? [] };
}

export const SETTING_KEYS = [
  "name", "participant_target", "research_video_count", "max_observation_seconds", "first_watch_seek_enabled", "first_watch_pause_enabled",
  "first_watch_text_enabled", "replay_enabled", "playback_rate", "practice_video_id", "ai_runs_per_video", "mobile_allowed", "timer_mode",
  "watermark_enabled", "consent_version", "security_notice_version",
] as const;

export async function updateSettings(studyId: string, patch: Record<string, unknown>, adminId: string, reason: string | null) {
  const { data, error } = await getServiceClient().rpc("update_study_settings", { p_study_id: studyId, p_patch: patch as Json, p_admin_id: adminId, p_reason: reason ?? undefined });
  if (error) throw fromDbError(error);
  return data;
}

export async function setStatus(studyId: string, status: StudyRow["status"], adminId: string, reason: string | null) {
  const { data, error } = await getServiceClient().rpc("set_study_status", { p_study_id: studyId, p_new_status: status, p_admin_id: adminId, p_reason: reason ?? undefined });
  if (error) throw fromDbError(error);
  return data;
}

export async function regenerateOrderGroups(studyId: string, adminId: string) {
  const { data, error } = await getServiceClient().rpc("regenerate_order_groups", { p_study_id: studyId, p_admin_id: adminId });
  if (error) throw fromDbError(error);
  return data;
}

export async function getOrderGroups(studyId: string) {
  const sb = getServiceClient();
  const [groups, checks, targets] = await Promise.all([
    sb.from("v_order_group_balance").select("*").eq("study_id", studyId).order("group_index"),
    sb.from("v_order_balance_check").select("*").eq("study_id", studyId),
    getTargets(studyId),
  ]);
  return { groups: groups.data ?? [], checks: checks.data ?? [], targets };
}

export async function getSettingsHistory(studyId: string, limit = 50) {
  const { data } = await getServiceClient()
    .from("study_settings")
    .select("id, setting_key, old_value, new_value, reason, created_at, changed_by")
    .eq("study_id", studyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export const STATUS_TRANSITIONS: Record<StudyRow["status"], StudyRow["status"][]> = {
  draft: ["pilot", "ready"],
  pilot: ["draft", "ready"],
  ready: ["draft", "pilot", "active"],
  active: ["paused", "closed"],
  paused: ["active", "closed"],
  closed: ["archived", "active"],
  archived: [],
};
