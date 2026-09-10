"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { getCurrentStudy } from "@/lib/services/admin/study";
import { createVideo, updateVideoMeta } from "@/lib/services/admin/videos";

function msg(e: unknown) {
  return e instanceof AppError ? e.message : e instanceof Error ? e.message : "오류가 발생했습니다";
}

export async function createVideoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const study = await getCurrentStudy();
    const input = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z]\d{2,3}$/, "코드는 V01 형식"), kind: z.enum(["research", "practice"]), title: z.string().trim().min(1) }).parse(Object.fromEntries(formData));
    await createVideo({ studyId: study.id, code: input.code, kind: input.kind, title: input.title, adminId: admin.id });
    revalidatePath("/admin/videos");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

const optInt = z.preprocess((v) => (v === "" || v === undefined ? null : Number(v)), z.number().int().min(0).nullable());
const optStr = z.preprocess((v) => (v === "" ? null : v), z.string().max(500).nullable());

export async function updateVideoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const input = z
      .object({
        video_id: z.string().uuid(),
        title_admin: z.string().trim().min(1),
        age_group: optStr,
        activity_type: optStr,
        complexity_level: optStr,
        actor_count: optInt,
        object_count: optInt,
        description_admin: z.preprocess((v) => (v === "" ? null : v), z.string().max(4000).nullable()),
        has_audio: z.enum(["true", "false"]).transform((v) => v === "true"),
        sort_order: z.coerce.number().int().min(0),
        active: z.enum(["true", "false"]).transform((v) => v === "true"),
      })
      .parse(Object.fromEntries(formData));
    const { video_id, ...patch } = input;
    await updateVideoMeta(video_id, patch, admin.id);
    revalidatePath("/admin/videos");
    revalidatePath(`/admin/videos/${video_id}`);
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}
