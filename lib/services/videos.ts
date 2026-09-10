import "server-only";
import { getServiceClient } from "@/lib/db/service-client";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { assertOwnership, type ParticipantContext } from "@/lib/auth/participant";
import { loadParticipantSnapshot } from "@/lib/participant/snapshot";
import { resolveNextStep } from "@/lib/participant/resolveNextStep";

export const VIDEO_BUCKET = "videos";

/**
 * 참여자용 signed URL 발급. 검사 순서:
 * 세션 → 소유 → 관찰 상태(pending/in_progress, 유효) → 현재 단계의 관찰인지(순서 강제) → 만료 아님 → 발급
 */
export async function signVideoForObservation(ctx: ParticipantContext, observationId: string) {
  const sb = getServiceClient();
  const { data: obs } = await sb
    .from("observations")
    .select("id, participant_id, status, invalidated, is_practice, video:videos(storage_path, mime_type)")
    .eq("id", observationId)
    .maybeSingle();
  assertOwnership(ctx, obs);
  const row = obs!;
  if (row.invalidated || row.status === "submitted") throw new AppError("OBSERVATION_CLOSED", "이 관찰은 종료되었습니다");

  await sb.rpc("finalize_expired_observations", { p_participant_id: ctx.participant.id });
  const step = resolveNextStep(await loadParticipantSnapshot(ctx));
  const allowed =
    (step.step === "practice" && step.observationId === row.id) ||
    (step.step === "observation" && step.observationId === row.id) ||
    (step.step === "study_hub" && step.nextObservationId === row.id);
  if (!allowed) throw new AppError("ORDER_VIOLATION", "지금 열 수 있는 관찰이 아닙니다");

  const video = row.video as { storage_path: string | null; mime_type: string } | null;
  if (!video?.storage_path) throw new AppError("NOT_FOUND", "영상 파일이 등록되지 않았습니다");

  const ttl = getEnv().VIDEO_SIGNED_URL_TTL_SECONDS;
  const { data, error } = await sb.storage.from(VIDEO_BUCKET).createSignedUrl(video.storage_path, ttl);
  if (error || !data) throw new AppError("INTERNAL", "영상 주소를 발급할 수 없습니다");
  return { url: data.signedUrl, expiresAt: new Date(Date.now() + ttl * 1000).toISOString(), mimeType: video.mime_type };
}

/** 관리자용 signed URL (1시간) */
export async function signVideoForAdmin(videoId: string) {
  const sb = getServiceClient();
  const { data: video } = await sb.from("videos").select("storage_path, mime_type").eq("id", videoId).maybeSingle();
  if (!video?.storage_path) throw new AppError("NOT_FOUND", "영상 파일이 등록되지 않았습니다");
  const { data, error } = await sb.storage.from(VIDEO_BUCKET).createSignedUrl(video.storage_path, 3600);
  if (error || !data) throw new AppError("INTERNAL", "영상 주소를 발급할 수 없습니다");
  return { url: data.signedUrl, expiresAt: new Date(Date.now() + 3600_000).toISOString(), mimeType: video.mime_type };
}
