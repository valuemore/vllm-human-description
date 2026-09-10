"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { invalidateObservation } from "@/lib/services/admin/observations";

export async function invalidateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const input = z.object({ observation_id: z.string().uuid(), reason: z.string().trim().min(2, "사유를 입력하세요"), create_retry: z.string().optional() }).parse(Object.fromEntries(formData));
    await invalidateObservation(input.observation_id, input.reason, admin.id, input.create_retry === "1");
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof AppError ? e.message : (e as Error).message };
  }
}
