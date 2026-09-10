"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { activatePrompt, createPromptVersion, createRun, importRunsCsv, updateRunNotes } from "@/lib/services/admin/ai";
import { getCurrentStudy } from "@/lib/services/admin/study";

function msg(e: unknown) {
  return e instanceof AppError ? e.message : e instanceof Error ? e.message : "오류가 발생했습니다";
}

export async function createPromptAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const study = await getCurrentStudy();
    const i = z.object({ prompt_code: z.string().trim().regex(/^[a-z0-9_-]{2,40}$/, "코드는 소문자/숫자/_-"), prompt_text: z.string().trim().min(5), notes: z.string().optional(), activate: z.string().optional() }).parse(Object.fromEntries(fd));
    await createPromptVersion({ studyId: study.id, promptCode: i.prompt_code, text: i.prompt_text, notes: i.notes || null, activate: i.activate === "1", adminId: admin.id });
    revalidatePath("/admin/ai");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function activatePromptAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    await activatePrompt(z.string().uuid().parse(fd.get("prompt_id")), admin.id);
    revalidatePath("/admin/ai");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function createRunAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const study = await getCurrentStudy();
    const i = z
      .object({
        video_id: z.string().uuid(),
        prompt_id: z.string().uuid(),
        provider: z.string().trim().min(1),
        model_name: z.string().trim().min(1),
        model_version: z.string().optional(),
        generated_text: z.string().trim().min(1),
        generated_at: z.string().optional(),
        settings_json: z.string().optional(),
        input_description: z.string().optional(),
        notes: z.string().optional(),
        supersedes_run_id: z.string().optional(),
      })
      .parse(Object.fromEntries(fd));
    let settings: Record<string, unknown> | null = null;
    if (i.settings_json?.trim()) {
      try {
        settings = JSON.parse(i.settings_json);
      } catch {
        return { error: "생성 설정은 JSON 형식이어야 합니다" };
      }
    }
    await createRun({
      studyId: study.id, videoId: i.video_id, promptId: i.prompt_id, provider: i.provider, modelName: i.model_name, modelVersion: i.model_version || null,
      generatedText: i.generated_text, generatedAt: i.generated_at ? new Date(i.generated_at).toISOString() : null, settings, inputDescription: i.input_description || null,
      notes: i.notes || null, supersedesRunId: i.supersedes_run_id || null, adminId: admin.id,
    });
    revalidatePath("/admin/ai");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function importRunsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const study = await getCurrentStudy();
    const file = fd.get("file");
    const text = file instanceof File && file.size > 0 ? await file.text() : String(fd.get("csv_text") ?? "");
    const r = await importRunsCsv(study.id, text, admin.id);
    revalidatePath("/admin/ai");
    const failed = r.results.filter((x) => !x.ok);
    return failed.length ? { ok: true, error: `${r.created}건 등록, ${failed.length}건 실패: ` + failed.map((f) => `${f.row}행 ${f.message}`).join("; ") } : { ok: true, code: `${r.created}건 등록` };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function updateRunNotesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { admin } = await requireAdmin();
    const i = z.object({ run_id: z.string().uuid(), notes: z.string().max(2000) }).parse(Object.fromEntries(fd));
    await updateRunNotes(i.run_id, i.notes, admin.id);
    revalidatePath("/admin/ai");
    return { ok: true };
  } catch (e) {
    return { error: msg(e) };
  }
}
