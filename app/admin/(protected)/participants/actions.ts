"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { changeOrderGroup, createParticipant, resetPin, updateParticipantNotes, withdrawParticipant } from "@/lib/services/admin/participants";
import { getCurrentStudy } from "@/lib/services/admin/study";

export type ActionState = { ok?: boolean; error?: string; pin?: string; code?: string };

function msg(e: unknown) {
  return e instanceof AppError ? e.message : e instanceof Error ? e.message : "오류가 발생했습니다";
}

export async function createParticipantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const study = await getCurrentStudy();
    const input = z
      .object({
        code: z.string().trim().toUpperCase().regex(/^[A-Z]\d{2,3}$/, "참여코드는 T01 형식입니다"),
        order_group_id: z.string().uuid(),
        replaced_participant_id: z.string().uuid().optional().or(z.literal("")),
        notes: z.string().max(500).optional(),
      })
      .parse(Object.fromEntries(formData));
    const { pin } = await createParticipant({
      studyId: study.id,
      code: input.code,
      orderGroupId: input.order_group_id,
      adminId: admin.id,
      replacedParticipantId: input.replaced_participant_id || null,
      notes: input.notes || null,
    });
    revalidatePath("/admin/participants");
    return { ok: true, pin, code: input.code };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function resetPinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const id = z.string().uuid().parse(formData.get("participant_id"));
    const { pin } = await resetPin(id, admin.id);
    revalidatePath(`/admin/participants/${id}`);
    return { ok: true, pin };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function changeGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const input = z.object({ participant_id: z.string().uuid(), order_group_id: z.string().uuid(), reason: z.string().trim().min(2, "사유를 입력하세요") }).parse(Object.fromEntries(formData));
    await changeOrderGroup(input.participant_id, input.order_group_id, admin.id, input.reason);
    revalidatePath("/admin/participants");
    revalidatePath(`/admin/participants/${input.participant_id}`);
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function withdrawAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const input = z.object({ participant_id: z.string().uuid(), reason: z.string().trim().min(2, "사유를 입력하세요"), status: z.enum(["withdrawn", "technical_issue"]) }).parse(Object.fromEntries(formData));
    await withdrawParticipant(input.participant_id, admin.id, input.reason, input.status);
    revalidatePath("/admin/participants");
    revalidatePath(`/admin/participants/${input.participant_id}`);
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function updateNotesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const input = z.object({ participant_id: z.string().uuid(), notes: z.string().max(2000) }).parse(Object.fromEntries(formData));
    await updateParticipantNotes(input.participant_id, input.notes);
    revalidatePath(`/admin/participants/${input.participant_id}`);
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}
