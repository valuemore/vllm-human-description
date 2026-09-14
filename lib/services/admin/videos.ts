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

/** 브라우저가 Private Storage 로 직접 PUT 할 수 있는 1회용 업로드 URL */
export async function createUploadUrl(videoId: string) {
  const video = await getVideo(videoId);
  if (video.storage_path && (await hasSubmittedObservations(videoId))) {
    throw new AppError("CONFLICT", "제출된 관찰기록이 있는 영상 파일은 교체할 수 없습니다. 새 영상으로 등록하세요.");
  }
  const path = storagePathFor(video);
  const { data, error } = await getServiceClient().storage.from(VIDEO_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) throw new AppError("INTERNAL", error?.message ?? "업로드 URL 발급 실패");
  return { signedUrl: data.signedUrl, token: data.token, path };
}

async function hasSubmittedObservations(videoId: string) {
  const { count } = await getServiceClient().from("observations").select("id", { count: "exact", head: true }).eq("video_id", videoId).eq("status", "submitted");
  return (count ?? 0) > 0;
}

export async function finalizeUpload(
  videoId: string,
  meta: { durationMs: number; width: number | null; height: number | null; fileSize: number | null; mimeType: string; hasAudio: boolean },
  adminId: string,
) {
  const sb = getServiceClient();
  const video = await getVideo(videoId);
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
    before: replaced ? { duration_ms: video.duration_ms, file_size_bytes: video.file_size_bytes } : null,
    after: { duration_ms: meta.durationMs, file_size_bytes: meta.fileSize, mime_type: meta.mimeType },
  });
  return data;
}
