import "server-only";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError, fromDbError } from "@/lib/errors";
import { parseCsvObjects } from "@/lib/export/csv-parse";
import { recordAudit } from "@/lib/services/admin/audit";
import type { Database } from "@/types/database";

export type ReferenceEventRow = Database["public"]["Tables"]["reference_events"]["Row"];

export type ReferenceEventInput = {
  eventCode?: string | null;
  eventOrder?: number | null;
  startMs: number | null;
  endMs: number | null;
  actor: string;
  action: string;
  object?: string | null;
  bodyPartOrTool?: string | null;
  relation?: string | null;
  previousEventId?: string | null;
  temporalRelation?: string | null;
  referenceSentence?: string | null;
  behaviorCategory?: string | null;
  notes?: string | null;
};

export async function listReferenceEvents(videoId: string) {
  const { data, error } = await getServiceClient().from("reference_events").select("*").eq("video_id", videoId).is("deleted_at", null).order("event_order");
  if (error) throw fromDbError(error);
  return data ?? [];
}

function toRow(i: ReferenceEventInput) {
  return {
    start_ms: i.startMs,
    end_ms: i.endMs,
    actor: i.actor.trim(),
    action: i.action.trim(),
    object: i.object?.trim() || null,
    body_part_or_tool: i.bodyPartOrTool?.trim() || null,
    relation: i.relation?.trim() || null,
    previous_event_id: i.previousEventId || null,
    temporal_relation: i.temporalRelation?.trim() || null,
    reference_sentence: i.referenceSentence?.trim() || null,
    behavior_category: i.behaviorCategory?.trim() || null,
    notes: i.notes?.trim() || null,
  };
}

/** app.admin_id 를 설정해 reference_event_versions.changed_by 에 기록되게 한다 (트랜잭션 로컬이므로 함수 내에서만 유효 → 별도 rpc 없이 audit 로 보완) */
export async function createReferenceEvent(studyId: string, videoId: string, input: ReferenceEventInput, adminId: string) {
  const sb = getServiceClient();
  const existing = await listReferenceEvents(videoId);
  const order = input.eventOrder ?? (existing.length ? Math.max(...existing.map((e) => e.event_order)) + 1 : 1);
  const code = input.eventCode?.trim() || `E${String(order).padStart(2, "0")}`;
  const { data, error } = await sb
    .from("reference_events")
    .insert({ study_id: studyId, video_id: videoId, event_code: code, event_order: order, coder_id: adminId, ...toRow(input) })
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  await recordAudit({ studyId, adminId, action: "reference_event_created", targetType: "reference_event", targetId: data.id, after: { video_id: videoId, event_code: code, actor: data.actor, action: data.action } });
  return data;
}

export async function updateReferenceEvent(eventId: string, input: Partial<ReferenceEventInput> & { eventCode?: string | null; eventOrder?: number | null }, adminId: string) {
  const sb = getServiceClient();
  const { data: before } = await sb.from("reference_events").select("*").eq("id", eventId).maybeSingle();
  if (!before) throw new AppError("NOT_FOUND", "Reference Event 를 찾을 수 없습니다");
  const patch: Database["public"]["Tables"]["reference_events"]["Update"] = {};
  if (input.eventCode) patch.event_code = input.eventCode;
  if (input.eventOrder !== undefined && input.eventOrder !== null) patch.event_order = input.eventOrder;
  if (input.startMs !== undefined) patch.start_ms = input.startMs;
  if (input.endMs !== undefined) patch.end_ms = input.endMs;
  if (input.actor !== undefined) patch.actor = input.actor.trim();
  if (input.action !== undefined) patch.action = input.action.trim();
  if (input.object !== undefined) patch.object = input.object?.trim() || null;
  if (input.bodyPartOrTool !== undefined) patch.body_part_or_tool = input.bodyPartOrTool?.trim() || null;
  if (input.relation !== undefined) patch.relation = input.relation?.trim() || null;
  if (input.previousEventId !== undefined) patch.previous_event_id = input.previousEventId || null;
  if (input.temporalRelation !== undefined) patch.temporal_relation = input.temporalRelation?.trim() || null;
  if (input.referenceSentence !== undefined) patch.reference_sentence = input.referenceSentence?.trim() || null;
  if (input.behaviorCategory !== undefined) patch.behavior_category = input.behaviorCategory?.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  const { data, error } = await sb.from("reference_events").update(patch).eq("id", eventId).select("*").single();
  if (error) throw fromDbError(error);
  await recordAudit({ studyId: before.study_id, adminId, action: "reference_event_updated", targetType: "reference_event", targetId: eventId, before: Object.fromEntries(Object.keys(patch).map((k) => [k, (before as Record<string, unknown>)[k]])), after: patch });
  return data;
}

export async function softDeleteReferenceEvent(eventId: string, adminId: string) {
  const sb = getServiceClient();
  const { data, error } = await sb.from("reference_events").update({ deleted_at: new Date().toISOString() }).eq("id", eventId).select("study_id, event_code, video_id").single();
  if (error) throw fromDbError(error);
  await recordAudit({ studyId: data.study_id, adminId, action: "reference_event_deleted", targetType: "reference_event", targetId: eventId, before: { event_code: data.event_code } });
}

/** 순서 이동: 대상 이벤트를 위/아래 이웃과 교환 (event_order UNIQUE 이므로 임시값 경유) */
export async function moveReferenceEvent(eventId: string, direction: "up" | "down", adminId: string) {
  const sb = getServiceClient();
  const { data: ev } = await sb.from("reference_events").select("id, video_id, event_order, study_id").eq("id", eventId).maybeSingle();
  if (!ev) throw new AppError("NOT_FOUND", "Reference Event 를 찾을 수 없습니다");
  const all = await listReferenceEvents(ev.video_id);
  const idx = all.findIndex((e) => e.id === eventId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;
  const other = all[swapIdx];
  const tmp = 100000 + ev.event_order;
  const steps = [
    sb.from("reference_events").update({ event_order: tmp }).eq("id", ev.id),
    sb.from("reference_events").update({ event_order: ev.event_order }).eq("id", other.id),
    sb.from("reference_events").update({ event_order: other.event_order }).eq("id", ev.id),
  ];
  for (const s of steps) {
    const { error } = await s;
    if (error) throw fromDbError(error);
  }
  await recordAudit({ studyId: ev.study_id, adminId, action: "reference_event_updated", targetType: "reference_event", targetId: eventId, before: { event_order: ev.event_order }, after: { event_order: other.event_order } });
}

export async function listReferenceVersions(eventId: string) {
  const { data } = await getServiceClient().from("reference_event_versions").select("*").eq("reference_event_id", eventId).order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * CSV import. 열: event_code?, event_order?, start_ms|start (mm:ss.s 허용), end_ms|end, actor, action, object?, body_part_or_tool?, relation?, temporal_relation?, reference_sentence?, behavior_category?, notes?
 * 같은 event_code 가 이미 있으면 갱신, 없으면 생성.
 */
export async function importReferenceCsv(studyId: string, videoId: string, csvText: string, adminId: string) {
  const rows = parseCsvObjects(csvText);
  if (!rows.length) throw new AppError("VALIDATION", "CSV 에 데이터 행이 없습니다");
  for (const k of ["actor", "action"]) if (!(k in rows[0])) throw new AppError("VALIDATION", `필수 열 누락: ${k}`);
  const existing = await listReferenceEvents(videoId);
  const byCode = new Map(existing.map((e) => [e.event_code, e]));
  const results: { row: number; ok: boolean; message: string }[] = [];
  let created = 0;
  let updated = 0;
  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    try {
      const input: ReferenceEventInput = {
        eventCode: r.event_code || null,
        eventOrder: r.event_order ? Number(r.event_order) : null,
        startMs: parseTime(r.start_ms ?? r.start),
        endMs: parseTime(r.end_ms ?? r.end),
        actor: r.actor,
        action: r.action,
        object: r.object,
        bodyPartOrTool: r.body_part_or_tool,
        relation: r.relation,
        temporalRelation: r.temporal_relation,
        referenceSentence: r.reference_sentence,
        behaviorCategory: r.behavior_category,
        notes: r.notes,
      };
      if (!input.actor || !input.action) throw new Error("actor/action 은 필수입니다");
      const prev = input.eventCode ? byCode.get(input.eventCode) : undefined;
      if (prev) {
        await updateReferenceEvent(prev.id, input, adminId);
        updated++;
        results.push({ row: line, ok: true, message: `${input.eventCode} 갱신` });
      } else {
        const created_ = await createReferenceEvent(studyId, videoId, input, adminId);
        byCode.set(created_.event_code, created_);
        created++;
        results.push({ row: line, ok: true, message: `${created_.event_code} 생성` });
      }
    } catch (e) {
      results.push({ row: line, ok: false, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return { created, updated, results };
}

/** "3200" | "3.2" | "00:03.2" | "0:03" → ms */
export function parseTime(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const s = v.trim();
  if (/^\d+$/.test(s)) return Number(s);
  if (/^\d+\.\d+$/.test(s)) return Math.round(Number(s) * 1000);
  const m = s.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (m) return Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000);
  throw new Error(`시간 형식 오류: ${v}`);
}
