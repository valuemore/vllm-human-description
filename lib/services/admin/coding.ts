import "server-only";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError, fromDbError } from "@/lib/errors";
import { countUnreviewedDrafts } from "@/lib/coding/draftClaims";
import { recordAudit } from "@/lib/services/admin/audit";
import type { Database } from "@/types/database";

export type SupportType = Database["public"]["Enums"]["support_type"];
export type AccuracyLevel = Database["public"]["Enums"]["accuracy_level"];

/** 코딩 대상 목록 (유효 교사 관찰 + AI run) + 이 코더의 세션 상태 */
export async function listSources(studyId: string, coderId: string, videoId?: string) {
  const sb = getServiceClient();
  let q = sb.from("v_coding_sources").select("*").eq("study_id", studyId);
  if (videoId) q = q.eq("video_id", videoId);
  const [{ data: sources, error }, { data: sessions }] = await Promise.all([
    q.order("video_code").order("source_type").order("source_label"),
    sb.from("coding_sessions").select("id, source_type, source_record_id, status, coder_id").eq("study_id", studyId),
  ]);
  if (error) throw fromDbError(error);
  const claimCounts = new Map<string, number>();
  const unreviewedCounts = new Map<string, number>();
  const ids = (sessions ?? []).map((s) => s.id);
  if (ids.length) {
    const { data: claims } = await sb.from("response_claims").select("id, coding_session_id").in("coding_session_id", ids);
    const sessionByClaim = new Map<string, string>();
    for (const c of claims ?? []) {
      claimCounts.set(c.coding_session_id, (claimCounts.get(c.coding_session_id) ?? 0) + 1);
      sessionByClaim.set(c.id, c.coding_session_id);
    }
    if (sessionByClaim.size) {
      const { data: drafts } = await sb.from("claim_codings").select("claim_id").eq("coder_id", coderId).not("draft_source", "is", null).is("reviewed_at", null).in("claim_id", [...sessionByClaim.keys()]);
      for (const d of drafts ?? []) {
        const sid = sessionByClaim.get(d.claim_id);
        if (sid) unreviewedCounts.set(sid, (unreviewedCounts.get(sid) ?? 0) + 1);
      }
    }
  }
  return (sources ?? []).map((s) => {
    const mine = (sessions ?? []).find((x) => x.source_type === s.source_type && x.source_record_id === s.source_record_id && x.coder_id === coderId);
    const others = (sessions ?? []).filter((x) => x.source_type === s.source_type && x.source_record_id === s.source_record_id && x.coder_id !== coderId);
    return { ...s, session: mine ?? null, claimCount: mine ? (claimCounts.get(mine.id) ?? 0) : 0, unreviewedDrafts: mine ? (unreviewedCounts.get(mine.id) ?? 0) : 0, otherCoders: others.length };
  });
}

export async function getOrCreateSession(studyId: string, sourceType: "teacher" | "ai", sourceRecordId: string, coderId: string) {
  const sb = getServiceClient();
  const { data: existing } = await sb.from("coding_sessions").select("id").eq("source_type", sourceType).eq("source_record_id", sourceRecordId).eq("coder_id", coderId).maybeSingle();
  if (existing) return existing.id;
  const { data: src } = await sb.from("v_coding_sources").select("video_id").eq("source_type", sourceType).eq("source_record_id", sourceRecordId).maybeSingle();
  if (!src?.video_id) throw new AppError("NOT_FOUND", "코딩 대상을 찾을 수 없습니다");
  const { data, error } = await sb.from("coding_sessions").insert({ study_id: studyId, coder_id: coderId, source_type: sourceType, source_record_id: sourceRecordId, video_id: src.video_id }).select("id").single();
  if (error) throw fromDbError(error);
  return data.id;
}

export async function getWorkspace(sessionId: string) {
  const sb = getServiceClient();
  const { data: session, error } = await sb.from("coding_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw fromDbError(error);
  if (!session) throw new AppError("NOT_FOUND", "코딩 세션을 찾을 수 없습니다");
  const [source, refs, claims, codings, video] = await Promise.all([
    sb.from("v_coding_sources").select("*").eq("source_type", session.source_type).eq("source_record_id", session.source_record_id).maybeSingle(),
    sb.from("reference_events").select("*").eq("video_id", session.video_id).is("deleted_at", null).order("event_order"),
    sb.from("response_claims").select("*").eq("coding_session_id", sessionId).order("claim_order"),
    sb.from("claim_codings").select("*").eq("coder_id", session.coder_id),
    sb.from("videos").select("code, title_admin, storage_path").eq("id", session.video_id).single(),
  ]);
  const codingByClaim = new Map((codings.data ?? []).map((c) => [c.claim_id, c]));
  return {
    session,
    source: source.data,
    referenceEvents: refs.data ?? [],
    claims: (claims.data ?? []).map((c) => ({ ...c, coding: codingByClaim.get(c.id) ?? null })),
    video: video.data,
  };
}

async function assertOpen(sessionId: string) {
  const { data } = await getServiceClient().from("coding_sessions").select("status, study_id").eq("id", sessionId).maybeSingle();
  if (!data) throw new AppError("NOT_FOUND", "코딩 세션을 찾을 수 없습니다");
  if (data.status !== "open") throw new AppError("CONFLICT", "확정된 세션입니다. 다시 열어야 수정할 수 있습니다.");
  return data;
}

export async function addClaim(sessionId: string, text: string, charStart: number | null, charEnd: number | null, adminId: string) {
  const sb = getServiceClient();
  const s = await assertOpen(sessionId);
  const { data: session } = await sb.from("coding_sessions").select("source_type, source_record_id").eq("id", sessionId).single();
  const { data: last } = await sb.from("response_claims").select("claim_order").eq("coding_session_id", sessionId).order("claim_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await sb
    .from("response_claims")
    .insert({ coding_session_id: sessionId, source_type: session!.source_type, source_record_id: session!.source_record_id, claim_order: (last?.claim_order ?? 0) + 1, claim_text: text.trim(), char_start: charStart, char_end: charEnd })
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  await recordAudit({ studyId: s.study_id, adminId, action: "claim_created", targetType: "response_claim", targetId: data.id, after: { session: sessionId, claim_order: data.claim_order } });
  return data;
}

/** 문장 단위 자동 분할 (Claim 이 없을 때만). 코더가 이후 합치거나 나눈다. */
export async function autoSplitClaims(sessionId: string, adminId: string) {
  const sb = getServiceClient();
  await assertOpen(sessionId);
  const { count } = await sb.from("response_claims").select("id", { count: "exact", head: true }).eq("coding_session_id", sessionId);
  if ((count ?? 0) > 0) throw new AppError("CONFLICT", "이미 Claim 이 있습니다");
  const { data: session } = await sb.from("coding_sessions").select("source_type, source_record_id").eq("id", sessionId).single();
  const { data: src } = await sb.from("v_coding_sources").select("text").eq("source_type", session!.source_type).eq("source_record_id", session!.source_record_id).single();
  const text = src?.text ?? "";
  const pieces: { text: string; start: number; end: number }[] = [];
  const re = /[^.!?。\n]+[.!?。]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const t = m[0].trim();
    if (!t) continue;
    const start = m.index + (m[0].length - m[0].trimStart().length);
    pieces.push({ text: t, start, end: start + t.length });
  }
  let n = 0;
  for (const p of pieces) {
    await addClaim(sessionId, p.text, p.start, p.end, adminId);
    n++;
  }
  return n;
}

export async function updateClaim(claimId: string, text: string, adminId: string) {
  const sb = getServiceClient();
  const { data: claim } = await sb.from("response_claims").select("coding_session_id").eq("id", claimId).maybeSingle();
  if (!claim) throw new AppError("NOT_FOUND", "Claim 없음");
  const s = await assertOpen(claim.coding_session_id);
  const { error } = await sb.from("response_claims").update({ claim_text: text.trim() }).eq("id", claimId);
  if (error) throw fromDbError(error);
  await recordAudit({ studyId: s.study_id, adminId, action: "claim_updated", targetType: "response_claim", targetId: claimId, after: { claim_text: text.trim() } });
}

export async function deleteClaim(claimId: string, adminId: string) {
  const sb = getServiceClient();
  const { data: claim } = await sb.from("response_claims").select("coding_session_id, claim_order").eq("id", claimId).maybeSingle();
  if (!claim) throw new AppError("NOT_FOUND", "Claim 없음");
  const s = await assertOpen(claim.coding_session_id);
  const { error } = await sb.from("response_claims").delete().eq("id", claimId);
  if (error) throw fromDbError(error);
  await recordAudit({ studyId: s.study_id, adminId, action: "claim_updated", targetType: "response_claim", targetId: claimId, before: { claim_order: claim.claim_order }, after: { deleted: true } });
}

export type CodingInput = {
  supportType: SupportType;
  matchedReferenceEventId: string | null;
  actorAccuracy: AccuracyLevel | null;
  actionAccuracy: AccuracyLevel | null;
  objectAccuracy: AccuracyLevel | null;
  temporalAccuracy: AccuracyLevel | null;
  granularityScore: number | null;
  notes: string | null;
};

export async function upsertCoding(claimId: string, coderId: string, input: CodingInput, adminId: string) {
  const sb = getServiceClient();
  const { data: claim } = await sb.from("response_claims").select("coding_session_id").eq("id", claimId).maybeSingle();
  if (!claim) throw new AppError("NOT_FOUND", "Claim 없음");
  const s = await assertOpen(claim.coding_session_id);
  const { data: existing } = await sb.from("claim_codings").select("id").eq("claim_id", claimId).eq("coder_id", coderId).maybeSingle();
  const row = {
    claim_id: claimId,
    coder_id: coderId,
    support_type: input.supportType,
    matched_reference_event_id: input.supportType === "observed" || input.supportType === "inference_supported" ? input.matchedReferenceEventId : null,
    actor_accuracy: input.actorAccuracy,
    action_accuracy: input.actionAccuracy,
    object_accuracy: input.objectAccuracy,
    temporal_accuracy: input.temporalAccuracy,
    granularity_score: input.granularityScore,
    notes: input.notes,
    reviewed_at: new Date().toISOString(),
  };
  const { data, error } = existing
    ? await sb.from("claim_codings").update(row).eq("id", existing.id).select("id").single()
    : await sb.from("claim_codings").insert(row).select("id").single();
  if (error) throw fromDbError(error);
  await recordAudit({ studyId: s.study_id, adminId, action: existing ? "claim_coding_updated" : "claim_coding_created", targetType: "claim_coding", targetId: data.id, after: { claim_id: claimId, support_type: input.supportType, matched: row.matched_reference_event_id } });
}

export async function setSessionStatus(sessionId: string, status: "open" | "finalized", notes: string | null) {
  const sb = getServiceClient();
  if (status === "finalized") {
    const { data: claims } = await sb.from("response_claims").select("id").eq("coding_session_id", sessionId);
    const { data: session } = await sb.from("coding_sessions").select("coder_id").eq("id", sessionId).single();
    const ids = (claims ?? []).map((c) => c.id);
    if (ids.length === 0) throw new AppError("VALIDATION", "Claim 이 없어 확정할 수 없습니다");
    const { data: codings } = await sb.from("claim_codings").select("id, draft_source, reviewed_at").in("claim_id", ids).eq("coder_id", session!.coder_id);
    const count = codings?.length ?? 0;
    if (count < ids.length) throw new AppError("VALIDATION", `코딩되지 않은 Claim 이 ${ids.length - count}개 있습니다`);
    const unreviewed = countUnreviewedDrafts(codings ?? []);
    if (unreviewed > 0) throw new AppError("VALIDATION", `확인되지 않은 초안 코딩이 ${unreviewed}개 있습니다. 각 Claim 을 확인 후 저장하세요`);
  }
  const { error } = await sb.from("coding_sessions").update({ status, finalized_at: status === "finalized" ? new Date().toISOString() : null, notes }).eq("id", sessionId);
  if (error) throw fromDbError(error);
}
