import "server-only";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError, fromDbError } from "@/lib/errors";
import { VIDEO_BUCKET } from "@/lib/services/videos";
import { recordAudit } from "@/lib/services/admin/audit";
import { exceedsResearchVideoMax, formatDurationKo, MAX_RESEARCH_VIDEO_MS } from "@/lib/video-limits";
import type { Database } from "@/types/database";

export type VideoRow = Database["public"]["Tables"]["videos"]["Row"];

export async function listVideos(studyId: string) {
  const sb = getServiceClient();
  const [videos, counts] = await Promise.all([
    sb.from("videos").select("*").eq("study_id", studyId).order("kind").order("sort_order").order("code"),
    sb.from("observations").select("video_id, status").eq("study_id", studyId).eq("status", "submitted"),
  ]);
  if (videos.error) throw fromDbError(videos.error);
  const submitted = new Map<string, number>();
  for (const o of counts.data ?? []) submitted.set(o.video_id, (submitted.get(o.video_id) ?? 0) + 1);
  return (videos.data ?? []).map((v) => ({ ...v, submitted_count: submitted.get(v.id) ?? 0 }));
}

export async function getVideo(videoId: string): Promise<VideoRow> {
  const { data, error } = await getServiceClient().from("videos").select("*").eq("id", videoId).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new AppError("NOT_FOUND", "영상을 찾을 수 없습니다");
  return data;
}

export async function createVideo(input: { studyId: string; code: string; kind: "research" | "practice"; title: string; adminId: string }) {
  const sb = getServiceClient();
  const { data: maxRow } = await sb.from("videos").select("sort_order").eq("study_id", input.studyId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await sb
    .from("videos")
    .insert({ study_id: input.studyId, code: input.code, kind: input.kind, title_admin: input.title, sort_order: (maxRow?.sort_order ?? 0) + 1 })
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  await recordAudit({ studyId: input.studyId, adminId: input.adminId, action: "video_updated", targetType: "video", targetId: data.id, after: { created: true, code: data.code, kind: data.kind } });
  return data;
}

export const VIDEO_META_KEYS = ["title_admin", "age_group", "activity_type", "complexity_level", "actor_count", "object_count", "description_admin", "has_audio", "sort_order", "active"] as const;

export async function updateVideoMeta(videoId: string, patch: Partial<Pick<VideoRow, (typeof VIDEO_META_KEYS)[number]>>, adminId: string) {
  const before = await getVideo(videoId);
  const { data, error } = await getServiceClient().from("videos").update(patch).eq("id", videoId).select("*").single();
  if (error) throw fromDbError(error);
  const changed: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) if ((before as Record<string, unknown>)[k] !== (data as Record<string, unknown>)[k]) changed[k] = (data as Record<string, unknown>)[k];
  if (Object.keys(changed).length) {
    await recordAudit({ studyId: before.study_id, adminId, action: "video_updated", targetType: "video", targetId: videoId, before: Object.fromEntries(Object.keys(changed).map((k) => [k, (before as Record<string, unknown>)[k]])), after: changed });
  }
  return data;
}

export function storagePathFor(video: Pick<VideoRow, "id" | "study_id">) {
  return `studies/${video.study_id}/videos/${video.id}.mp4`;
}

export const REPLACE_REASON_MIN = 5;

/** 제출 기록이 있는 영상의 기존 파일 백업 경로 (같은 폴더, 원본 객체는 덮어쓰기 전에 여기로 복사된다) */
export function backupPathFor(video: Pick<VideoRow, "id" | "study_id">, at: Date = new Date()) {
  const stamp = at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `studies/${video.study_id}/videos/${video.id}.replaced-${stamp}.mp4`;
}

/**
 * 브라우저가 Private Storage 로 직접 PUT 할 수 있는 1회용 업로드 URL.
 * 제출된 관찰기록이 있는 영상은 기본적으로 교체를 거부한다. 같은 영상의 재인코딩 등 자극물이 바뀌지 않는 교체는
 * 사유(필수)를 받아 허용하되, 덮어쓰기 전에 기존 파일을 백업 경로로 복사해 원본을 보존한다 (finalize 에서 감사 기록).
 */
export async function createUploadUrl(videoId: string, opts: { replaceReason?: string | null } = {}) {
  const video = await getVideo(videoId);
  const submitted = video.storage_path ? await countSubmittedObservations(videoId) : 0;
  const reason = opts.replaceReason?.trim() ?? "";
  let backupPath: string | null = null;
  const sb = getServiceClient();
  if (submitted > 0) {
    if (reason.length < REPLACE_REASON_MIN) {
      throw new AppError("CONFLICT", `제출된 관찰기록이 ${submitted}건 있는 영상입니다. 교체하려면 사유(${REPLACE_REASON_MIN}자 이상)를 입력하세요. 기존 파일은 백업으로 보존됩니다.`);
    }
    backupPath = backupPathFor(video);
    const { error: copyErr } = await sb.storage.from(VIDEO_BUCKET).copy(video.storage_path!, backupPath);
    if (copyErr) throw new AppError("INTERNAL", `기존 파일 백업에 실패해 교체를 중단했습니다: ${copyErr.message}`);
  }
  const path = storagePathFor(video);
  const { data, error } = await sb.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) throw new AppError("INTERNAL", error?.message ?? "업로드 URL 발급 실패");
  return { signedUrl: data.signedUrl, token: data.token, path, backupPath, submittedCount: submitted };
}

async function countSubmittedObservations(videoId: string) {
  const { count } = await getServiceClient().from("observations").select("id", { count: "exact", head: true }).eq("video_id", videoId).eq("status", "submitted");
  return count ?? 0;
}

export async function finalizeUpload(
  videoId: string,
  meta: { durationMs: number; width: number | null; height: number | null; fileSize: number | null; mimeType: string; hasAudio: boolean },
  adminId: string,
  opts: { replaceReason?: string | null; backupPath?: string | null } = {},
) {
  const sb = getServiceClient();
  const video = await getVideo(videoId);
  const submitted = video.storage_path ? await countSubmittedObservations(videoId) : 0;
  const reason = opts.replaceReason?.trim() ?? "";
  if (submitted > 0 && reason.length < REPLACE_REASON_MIN) {
    throw new AppError("CONFLICT", "제출된 관찰기록이 있는 영상의 교체에는 사유가 필요합니다.");
  }
  if (video.kind === "research" && exceedsResearchVideoMax(meta.durationMs)) {
    throw new AppError(
      "VALIDATION",
      `연구영상은 최대 ${formatDurationKo(MAX_RESEARCH_VIDEO_MS)}까지 허용됩니다 (업로드 파일 ${(meta.durationMs / 1000).toFixed(1)}초). 파일을 편집한 뒤 다시 업로드하세요.`,
    );
  }
  const path = storagePathFor(video);
  // 객체 존재 확인
  const dir = path.slice(0, path.lastIndexOf("/"));
  const { data: objects, error: listErr } = await sb.storage.from(VIDEO_BUCKET).list(dir, { search: `${video.id}.mp4` });
  if (listErr || !objects?.some((o) => o.name === `${video.id}.mp4`)) throw new AppError("VALIDATION", "업로드된 파일을 찾을 수 없습니다");
  const replaced = !!video.storage_path;
  const { data, error } = await sb
    .from("videos")
    .update({ storage_path: path, duration_ms: meta.durationMs, width: meta.width, height: meta.height, file_size_bytes: meta.fileSize, mime_type: meta.mimeType, has_audio: meta.hasAudio })
    .eq("id", videoId)
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  await recordAudit({
    studyId: video.study_id, adminId, action: replaced ? "video_replaced" : "video_uploaded", targetType: "video", targetId: videoId,
    before: replaced
      ? { duration_ms: video.duration_ms, file_size_bytes: video.file_size_bytes, mime_type: video.mime_type, has_audio: video.has_audio, width: video.width, height: video.height, backup_path: opts.backupPath ?? null }
      : null,
    after: {
      duration_ms: meta.durationMs, file_size_bytes: meta.fileSize, mime_type: meta.mimeType, has_audio: meta.hasAudio, width: meta.width, height: meta.height,
      ...(submitted > 0 ? { submitted_observations: submitted, replace_reason: reason } : {}),
    },
  });
  return data;
}
