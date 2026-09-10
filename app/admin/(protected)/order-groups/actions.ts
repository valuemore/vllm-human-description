"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { getCurrentStudy, regenerateOrderGroups } from "@/lib/services/admin/study";
import type { ActionState } from "@/components/admin/ActionForm";

export async function regenerateAction(): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const study = await getCurrentStudy();
    await regenerateOrderGroups(study.id, admin.id);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof AppError ? e.message : (e as Error).message };
  }
}
