"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { createReferenceEvent, importReferenceCsv, moveReferenceEvent, parseTime, softDeleteReferenceEvent, updateReferenceEvent } from "@/lib/services/admin/reference";
import { getCurrentStudy } from "@/lib/services/admin/study";

function msg(e: unknown) {
  return e instanceof AppError ? e.message : e instanceof Error ? e.message : "오류가 발생했습니다";
}

const opt = z.string().optional();
const eventSchema = z.object({
  event_code: opt,
  event_order: opt,
  start: opt,
  end: opt,
  actor: z.string().trim().min(1, "행위자 필수"),
  action: z.string().trim().min(1, "행동 필수"),
  object: opt,
  body_part_or_tool: opt,
  relation: opt,
  previous_event_id: opt,
  temporal_relation: opt,
  reference_sentence: opt,
  behavior_category: opt,
  notes: opt,
});

function toInput(i: z.infer<typeof eventSchema>) {
  return {
    eventCode: i.event_code || null,
    eventOrder: i.event_order ? Number(i.event_order) : null,
    startMs: parseTime(i.start),
    endMs: parseTime(i.end),
    actor: i.actor,
    action: i.action,
    object: i.object,
    bodyPartOrTool: i.body_part_or_tool,
    relation: i.relation,
    previousEventId: i.previous_event_id || null,
    temporalRelation: i.temporal_relation,
    referenceSentence: i.reference_sentence,
    behaviorCategory: i.behavior_category,
    notes: i.notes,
  };
}

export async function createEventAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const study = await getCurrentStudy();
    const videoId = z.string().uuid().parse(fd.get("video_id"));
    const i = eventSchema.parse(Object.fromEntries(fd));
    await createReferenceEvent(study.id, videoId, toInput(i), admin.id);
    revalidatePath("/admin/reference");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function updateEventAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const eventId = z.string().uuid().parse(fd.get("event_id"));
    const i = eventSchema.parse(Object.fromEntries(fd));
    await updateReferenceEvent(eventId, toInput(i), admin.id);
    revalidatePath("/admin/reference");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function deleteEventAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    await softDeleteReferenceEvent(z.string().uuid().parse(fd.get("event_id")), admin.id);
    revalidatePath("/admin/reference");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function moveEventAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    await moveReferenceEvent(z.string().uuid().parse(fd.get("event_id")), fd.get("direction") === "up" ? "up" : "down", admin.id);
    revalidatePath("/admin/reference");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function importReferenceAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const study = await getCurrentStudy();
    const videoId = z.string().uuid().parse(fd.get("video_id"));
    const file = fd.get("file");
    const text = file instanceof File && file.size > 0 ? await file.text() : String(fd.get("csv_text") ?? "");
    const r = await importReferenceCsv(study.id, videoId, text, admin.id);
    revalidatePath("/admin/reference");
    const failed = r.results.filter((x) => !x.ok);
    return failed.length ? { ok: true, error: `${r.created} 생성 / ${r.updated} 갱신, ${failed.length}건 실패: ` + failed.map((f) => `${f.row}행 ${f.message}`).join("; ") } : { ok: true, code: `${r.created} 생성 / ${r.updated} 갱신` };
  } catch (e) {
    return { error: msg(e) };
  }
}
