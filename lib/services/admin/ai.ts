import "server-only";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError, fromDbError } from "@/lib/errors";
import { parseCsvObjects } from "@/lib/export/csv-parse";
import { computeTextStats } from "@/lib/text-stats";
import { recordAudit } from "@/lib/services/admin/audit";
import type { Json } from "@/types/database";

export async function listPrompts(studyId: string) {
  const { data, error } = await getServiceClient().from("ai_prompts").select("*").eq("study_id", studyId).order("prompt_code").order("version", { ascending: false });
  if (error) throw fromDbError(error);
  return data ?? [];
}

/** 새 프롬프트 버전 등록 (기존 버전은 불변). activate 면 같은 코드의 활성 버전을 교체 */
export async function createPromptVersion(input: { studyId: string; promptCode: string; text: string; notes?: string | null; activate: boolean; adminId: string }) {
  const sb = getServiceClient();
  const { data: latest } = await sb.from("ai_prompts").select("version").eq("study_id", input.studyId).eq("prompt_code", input.promptCode).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (latest?.version ?? 0) + 1;
  if (input.activate) await sb.from("ai_prompts").update({ active: false }).eq("study_id", input.studyId).eq("prompt_code", input.promptCode).eq("active", true);
  const { data, error } = await sb
    .from("ai_prompts")
    .insert({ study_id: input.studyId, prompt_code: input.promptCode, version, prompt_text: input.text, notes: input.notes ?? null, active: input.activate, created_by: input.adminId })
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  await recordAudit({ studyId: input.studyId, adminId: input.adminId, action: "ai_prompt_created", targetType: "ai_prompt", targetId: data.id, after: { prompt_code: input.promptCode, version, active: input.activate } });
  return data;
}

export async function activatePrompt(promptId: string, adminId: string) {
  const sb = getServiceClient();
  const { data: p } = await sb.from("ai_prompts").select("*").eq("id", promptId).maybeSingle();
  if (!p) throw new AppError("NOT_FOUND", "프롬프트를 찾을 수 없습니다");
  await sb.from("ai_prompts").update({ active: false }).eq("study_id", p.study_id).eq("prompt_code", p.prompt_code).eq("active", true);
  const { error } = await sb.from("ai_prompts").update({ active: true }).eq("id", promptId);
  if (error) throw fromDbError(error);
  await recordAudit({ studyId: p.study_id, adminId, action: "ai_prompt_updated", targetType: "ai_prompt", targetId: promptId, after: { active: true, version: p.version } });
}

export async function listRuns(studyId: string) {
  const { data, error } = await getServiceClient()
    .from("ai_runs")
    .select("*, video:videos(code, title_admin), prompt:ai_prompts(prompt_code, version)")
    .eq("study_id", studyId)
    .order("created_at");
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => ({
    ...r,
    video_code: (r.video as { code: string }).code,
    video_title: (r.video as { title_admin: string }).title_admin,
    prompt_code: (r.prompt as { prompt_code: string }).prompt_code,
    prompt_version: (r.prompt as { version: number }).version,
  }));
}

export type RunInput = {
  studyId: string;
  videoId: string;
  runNumber?: number | null;
  provider: string;
  modelName: string;
  modelVersion?: string | null;
  promptId: string;
  generatedText: string;
  generatedAt?: string | null;
  settings?: Record<string, unknown> | null;
  inputDescription?: string | null;
  notes?: string | null;
  supersedesRunId?: string | null;
  adminId: string;
};

/** AI run 등록. run_number 미지정 시 (video, prompt) 내 다음 번호. 기존 run 대체 시 superseded_by 연결. */
export async function createRun(input: RunInput) {
  const sb = getServiceClient();
  const { data: prompt } = await sb.from("ai_prompts").select("id, prompt_text, study_id").eq("id", input.promptId).maybeSingle();
  if (!prompt || prompt.study_id !== input.studyId) throw new AppError("VALIDATION", "프롬프트 버전이 올바르지 않습니다");
  let runNumber = input.runNumber ?? null;
  if (!runNumber) {
    const { data: last } = await sb.from("ai_runs").select("run_number").eq("video_id", input.videoId).eq("prompt_version_id", input.promptId).order("run_number", { ascending: false }).limit(1).maybeSingle();
    runNumber = (last?.run_number ?? 0) + 1;
  }
  const stats = computeTextStats(input.generatedText);
  const { data, error } = await sb
    .from("ai_runs")
    .insert({
      study_id: input.studyId,
      video_id: input.videoId,
      run_number: runNumber,
      provider: input.provider,
      model_name: input.modelName,
      model_version_or_snapshot: input.modelVersion ?? null,
      prompt_version_id: input.promptId,
      prompt_text_snapshot: prompt.prompt_text,
      generated_text: input.generatedText,
      generated_at: input.generatedAt ?? null,
      generation_settings_json: (input.settings ?? {}) as Json,
      input_description: input.inputDescription ?? null,
      character_count: stats.characterCount,
      word_count: stats.wordCount,
      sentence_count: stats.sentenceCount,
      notes: input.notes ?? null,
      created_by: input.adminId,
    })
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  if (input.supersedesRunId) {
    const { error: sErr } = await sb.from("ai_runs").update({ superseded_by: data.id }).eq("id", input.supersedesRunId);
    if (sErr) throw fromDbError(sErr);
    await recordAudit({ studyId: input.studyId, adminId: input.adminId, action: "ai_run_updated", targetType: "ai_run", targetId: input.supersedesRunId, after: { superseded_by: data.id } });
  }
  await recordAudit({ studyId: input.studyId, adminId: input.adminId, action: "ai_run_created", targetType: "ai_run", targetId: data.id, after: { video_id: input.videoId, run_number: runNumber, model: input.modelName } });
  return data;
}

export async function updateRunNotes(runId: string, notes: string, adminId: string) {
  const sb = getServiceClient();
  const { data, error } = await sb.from("ai_runs").update({ notes }).eq("id", runId).select("study_id").single();
  if (error) throw fromDbError(error);
  await recordAudit({ studyId: data.study_id, adminId, action: "ai_run_updated", targetType: "ai_run", targetId: runId, after: { notes } });
}

/**
 * CSV import. 필수 열: video_code, provider, model_name, prompt_code, generated_text
 * 선택 열: run_number, model_version, prompt_version(미지정 시 활성 버전), generated_at, notes, settings_json
 */
export async function importRunsCsv(studyId: string, csvText: string, adminId: string) {
  const sb = getServiceClient();
  const rows = parseCsvObjects(csvText);
  if (rows.length === 0) throw new AppError("VALIDATION", "CSV 에 데이터 행이 없습니다");
  const required = ["video_code", "provider", "model_name", "prompt_code", "generated_text"];
  const missing = required.filter((k) => !(k in rows[0]));
  if (missing.length) throw new AppError("VALIDATION", `필수 열 누락: ${missing.join(", ")}`);
  const [{ data: videos }, { data: prompts }] = await Promise.all([
    sb.from("videos").select("id, code").eq("study_id", studyId).eq("kind", "research"),
    sb.from("ai_prompts").select("id, prompt_code, version, active").eq("study_id", studyId),
  ]);
  const videoByCode = new Map((videos ?? []).map((v) => [v.code.toUpperCase(), v.id]));
  const results: { row: number; ok: boolean; message: string }[] = [];
  let created = 0;
  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    try {
      const videoId = videoByCode.get(r.video_code.toUpperCase());
      if (!videoId) throw new Error(`영상 코드 ${r.video_code} 없음`);
      const candidates = (prompts ?? []).filter((p) => p.prompt_code === r.prompt_code);
      const prompt = r.prompt_version ? candidates.find((p) => p.version === Number(r.prompt_version)) : candidates.find((p) => p.active);
      if (!prompt) throw new Error(`프롬프트 ${r.prompt_code} v${r.prompt_version || "(active)"} 없음`);
      if (!r.generated_text) throw new Error("generated_text 비어 있음");
      let settings: Record<string, unknown> | null = null;
      if (r.settings_json) {
        try {
          settings = JSON.parse(r.settings_json);
        } catch {
          throw new Error("settings_json 이 JSON 이 아닙니다");
        }
      }
      await createRun({
        studyId, videoId, runNumber: r.run_number ? Number(r.run_number) : null, provider: r.provider, modelName: r.model_name, modelVersion: r.model_version || null,
        promptId: prompt.id, generatedText: r.generated_text, generatedAt: r.generated_at || null, settings, notes: r.notes || null, adminId,
      });
      created++;
      results.push({ row: line, ok: true, message: `${r.video_code} run 등록` });
    } catch (e) {
      results.push({ row: line, ok: false, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return { created, results };
}
