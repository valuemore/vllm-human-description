"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { addClaim, autoSplitClaims, deleteClaim, getOrCreateSession, setSessionStatus, updateClaim, upsertCoding } from "@/lib/services/admin/coding";
import { getCurrentStudy } from "@/lib/services/admin/study";

function msg(e: unknown) {
  return e instanceof AppError ? e.message : e instanceof Error ? e.message : "오류가 발생했습니다";
}

export async function openSessionAction(fd: FormData) {
  const { admin } = await requireAdmin();
  const study = await getCurrentStudy();
  const i = z.object({ source_type: z.enum(["teacher", "ai"]), source_record_id: z.string().uuid() }).parse(Object.fromEntries(fd));
  const id = await getOrCreateSession(study.id, i.source_type, i.source_record_id, admin.id);
  redirect(`/admin/coding/${id}`);
}

const accuracy = z.enum(["correct", "partial", "incorrect", "not_applicable"]).nullable();
const optAcc = z.preprocess((v) => (v === "" || v === undefined ? null : v), accuracy);

export async function addClaimAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const i = z.object({ session_id: z.string().uuid(), text: z.string().trim().min(1), char_start: z.string().optional(), char_end: z.string().optional() }).parse(Object.fromEntries(fd));
    await addClaim(i.session_id, i.text, i.char_start ? Number(i.char_start) : null, i.char_end ? Number(i.char_end) : null, admin.id);
    revalidatePath(`/admin/coding/${i.session_id}`);
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function autoSplitAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const sessionId = z.string().uuid().parse(fd.get("session_id"));
    const n = await autoSplitClaims(sessionId, admin.id);
    revalidatePath(`/admin/coding/${sessionId}`);
    return { ok: true, code: `${n}개 Claim 생성` };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function updateClaimAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const i = z.object({ session_id: z.string().uuid(), claim_id: z.string().uuid(), text: z.string().trim().min(1) }).parse(Object.fromEntries(fd));
    await updateClaim(i.claim_id, i.text, admin.id);
    revalidatePath(`/admin/coding/${i.session_id}`);
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function deleteClaimAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const i = z.object({ session_id: z.string().uuid(), claim_id: z.string().uuid() }).parse(Object.fromEntries(fd));
    await deleteClaim(i.claim_id, admin.id);
    revalidatePath(`/admin/coding/${i.session_id}`);
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function codeClaimAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const i = z
      .object({
        session_id: z.string().uuid(),
        claim_id: z.string().uuid(),
        support_type: z.enum(["observed", "observed_unreferenced", "inference_supported", "inference_unsupported", "hallucination", "unclear"]),
        matched_reference_event_id: z.preprocess((v) => (v === "" ? null : v), z.string().uuid().nullable()),
        actor_accuracy: optAcc,
        action_accuracy: optAcc,
        object_accuracy: optAcc,
        temporal_accuracy: optAcc,
        granularity_score: z.preprocess((v) => (v === "" || v === undefined ? null : Number(v)), z.number().int().min(1).max(3).nullable()),
        notes: z.string().optional(),
      })
      .parse(Object.fromEntries(fd));
    await upsertCoding(
      i.claim_id,
      admin.id,
      {
        supportType: i.support_type,
        matchedReferenceEventId: i.matched_reference_event_id,
        actorAccuracy: i.actor_accuracy,
        actionAccuracy: i.action_accuracy,
        objectAccuracy: i.object_accuracy,
        temporalAccuracy: i.temporal_accuracy,
        granularityScore: i.granularity_score,
        notes: i.notes?.trim() || null,
      },
      admin.id,
    );
    revalidatePath(`/admin/coding/${i.session_id}`);
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function sessionStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const i = z.object({ session_id: z.string().uuid(), status: z.enum(["open", "finalized"]), notes: z.string().optional() }).parse(Object.fromEntries(fd));
    await setSessionStatus(i.session_id, i.status, i.notes?.trim() || null);
    revalidatePath(`/admin/coding/${i.session_id}`);
    revalidatePath("/admin/coding");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}
