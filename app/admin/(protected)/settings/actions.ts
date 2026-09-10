"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { getCurrentStudy, setStatus, updateSettings } from "@/lib/services/admin/study";

const boolStr = z.enum(["true", "false"]).transform((v) => v === "true");
const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  participant_target: z.coerce.number().int().min(1).optional(),
  research_video_count: z.coerce.number().int().min(2).max(20).optional(),
  max_observation_seconds: z.coerce.number().int().min(30).max(3600).optional(),
  timer_mode: z.enum(["wall_time", "effective_time"]).optional(),
  first_watch_seek_enabled: boolStr.optional(),
  first_watch_pause_enabled: boolStr.optional(),
  replay_enabled: boolStr.optional(),
  mobile_allowed: boolStr.optional(),
  watermark_enabled: boolStr.optional(),
  ai_runs_per_video: z.coerce.number().int().min(1).max(5).optional(),
  practice_video_id: z.string().uuid().nullable().optional(),
  consent_version: z.string().trim().min(1).optional(),
});

function msg(e: unknown) {
  return e instanceof AppError ? e.message : e instanceof Error ? e.message : "오류가 발생했습니다";
}

export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const study = await getCurrentStudy();
    const raw = Object.fromEntries(formData) as Record<string, string>;
    const reason = raw.reason?.trim() || null;
    delete raw.reason;
    if (raw.practice_video_id === "") raw.practice_video_id = null as unknown as string;
    const patch = patchSchema.parse(raw);
    // 값이 바뀐 항목만 전송
    const changed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if ((study as Record<string, unknown>)[k] !== v) changed[k] = v;
    }
    if (Object.keys(changed).length === 0) return { ok: true };
    if (study.status === "active" && !reason) return { error: "진행 중인 연구의 설정 변경에는 사유가 필요합니다." };
    await updateSettings(study.id, changed, admin.id, reason);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function setStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const study = await getCurrentStudy();
    const input = z.object({ status: z.enum(["draft", "pilot", "ready", "active", "paused", "closed", "archived"]), reason: z.string().optional() }).parse(Object.fromEntries(formData));
    await setStatus(study.id, input.status, admin.id, input.reason?.trim() || null);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}
