import "server-only";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError, fromDbError } from "@/lib/errors";
import { generatePin, hashPin } from "@/lib/auth/pin";
import { recommendGroupIndex } from "@/lib/order-balance";

export async function listParticipants(studyId: string) {
  const { data, error } = await getServiceClient().from("v_participant_progress").select("*").eq("study_id", studyId).order("participant_code");
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function nextParticipantCode(studyId: string, prefix = "T") {
  const { data } = await getServiceClient().from("participants").select("participant_code").eq("study_id", studyId).like("participant_code", `${prefix}%`);
  const max = (data ?? []).reduce((m, r) => Math.max(m, Number(r.participant_code.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

export async function recommendedGroup(studyId: string) {
  const { data } = await getServiceClient().from("v_order_group_balance").select("order_group_id, group_index, assigned_valid, target_participants").eq("study_id", studyId);
  const idx = recommendGroupIndex((data ?? []).map((g) => ({ groupIndex: g.group_index ?? 0, assignedValid: g.assigned_valid ?? 0, target: g.target_participants ?? 0 })));
  return (data ?? []).find((g) => g.group_index === idx) ?? null;
}

/** 참여자 생성. 평문 PIN 은 이 반환값에서 1회만 노출된다. */
export async function createParticipant(input: {
  studyId: string; code: string; orderGroupId: string; adminId: string; replacedParticipantId?: string | null; notes?: string | null; pin?: string;
}) {
  const pin = input.pin ?? generatePin();
  const { data, error } = await getServiceClient().rpc("create_participant_with_assignments", {
    p_study_id: input.studyId,
    p_code: input.code,
    p_pin_hash: await hashPin(pin),
    p_order_group_id: input.orderGroupId,
    p_admin_id: input.adminId,
    p_replaced_participant_id: input.replacedParticipantId ?? undefined,
    p_notes: input.notes ?? undefined,
  });
  if (error) throw fromDbError(error);
  return { participant: data, pin };
}

export async function resetPin(participantId: string, adminId: string) {
  const pin = generatePin();
  const { error } = await getServiceClient().rpc("reset_participant_pin", { p_participant_id: participantId, p_pin_hash: await hashPin(pin), p_admin_id: adminId });
  if (error) throw fromDbError(error);
  return { pin };
}

export async function changeOrderGroup(participantId: string, newGroupId: string, adminId: string, reason: string) {
  const { data, error } = await getServiceClient().rpc("change_order_group", { p_participant_id: participantId, p_new_group_id: newGroupId, p_admin_id: adminId, p_reason: reason });
  if (error) throw fromDbError(error);
  return data;
}

export async function withdrawParticipant(participantId: string, adminId: string, reason: string, status: "withdrawn" | "technical_issue") {
  const { data, error } = await getServiceClient().rpc("withdraw_participant", { p_participant_id: participantId, p_admin_id: adminId, p_reason: reason, p_status: status });
  if (error) throw fromDbError(error);
  return data;
}

export async function updateParticipantNotes(participantId: string, notes: string) {
  const { error } = await getServiceClient().from("participants").update({ notes_admin: notes }).eq("id", participantId);
  if (error) throw fromDbError(error);
}

export async function getParticipantDetail(participantId: string) {
  const sb = getServiceClient();
  const { data: p, error } = await sb.from("v_participant_progress").select("*").eq("participant_id", participantId).maybeSingle();
  if (error) throw fromDbError(error);
  if (!p) throw new AppError("NOT_FOUND", "참여자를 찾을 수 없습니다");
  const [observations, sessions, consents, demographics, audits] = await Promise.all([
    sb.from("v_observation_metrics").select("*").eq("participant_id", participantId).order("is_practice", { ascending: false }).order("presentation_order").order("attempt_number"),
    sb.from("participant_sessions").select("id, issued_at, expires_at, revoked_at, last_seen_at, user_agent").eq("participant_id", participantId).order("issued_at", { ascending: false }).limit(20),
    sb.from("participant_consents").select("consent_type, consent_version, consented, consented_at").eq("participant_id", participantId).order("consented_at"),
    sb.from("participant_demographics").select("*").eq("participant_id", participantId).maybeSingle(),
    sb.from("audit_logs").select("id, action, before_json, after_json, created_at").eq("target_id", participantId).order("created_at", { ascending: false }).limit(50),
  ]);
  return { participant: p, observations: observations.data ?? [], sessions: sessions.data ?? [], consents: consents.data ?? [], demographics: demographics.data, audits: audits.data ?? [] };
}
