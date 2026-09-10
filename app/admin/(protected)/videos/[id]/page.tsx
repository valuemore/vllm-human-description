import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field, inputCls } from "@/components/admin/ActionForm";
import { VideoUploader } from "@/components/admin/VideoUploader";
import { PageHeader, Section, fmtDate } from "@/components/admin/ui";
import { AppError } from "@/lib/errors";
import { getVideo } from "@/lib/services/admin/videos";
import { signVideoForAdmin } from "@/lib/services/videos";
import { getServiceClient } from "@/lib/db/service-client";
import { updateVideoAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function VideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let video;
  try {
    video = await getVideo(id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const signed = video.storage_path ? await signVideoForAdmin(video.id).catch(() => null) : null;
  const { count: submitted } = await getServiceClient().from("observations").select("id", { count: "exact", head: true }).eq("video_id", id).eq("status", "submitted");

  return (
    <>
      <PageHeader
        title={`${video.code} · ${video.title_admin}`}
        description={`${video.kind} · 등록 ${fmtDate(video.created_at)} · 제출 기록 ${submitted ?? 0}건`}
        actions={
          <Link className="text-sm underline" href="/admin/videos">
            목록
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="미리보기 (관리자 signed URL, 1시간)">
          {signed ? (
            <video src={signed.url} controls controlsList="nodownload" className="w-full rounded bg-black" preload="metadata" />
          ) : (
            <p className="text-sm text-muted-foreground">영상 파일이 없습니다.</p>
          )}
          <div className="mt-3">
            <VideoUploader videoId={video.id} replaceWarning={!!video.storage_path} disabled={(submitted ?? 0) > 0 && !!video.storage_path} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">길이</dt>
            <dd className="font-mono">{video.duration_ms ? `${(video.duration_ms / 1000).toFixed(2)}s` : "—"}</dd>
            <dt className="text-muted-foreground">해상도</dt>
            <dd className="font-mono">{video.width ? `${video.width}×${video.height}` : "—"}</dd>
            <dt className="text-muted-foreground">파일 크기</dt>
            <dd className="font-mono">{video.file_size_bytes ? `${(video.file_size_bytes / 1048576).toFixed(1)} MB` : "—"}</dd>
            <dt className="text-muted-foreground">MIME</dt>
            <dd className="font-mono">{video.mime_type}</dd>
          </dl>
        </Section>

        <Section title="메타데이터 (참여자에게 노출되지 않음)">
          <ActionForm action={updateVideoAction} submitLabel="저장">
            <input type="hidden" name="video_id" value={video.id} />
            <Field label="관리자용 제목">
              <input name="title_admin" defaultValue={video.title_admin} className={inputCls} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="영유아 연령대">
                <input name="age_group" defaultValue={video.age_group ?? ""} className={inputCls} placeholder="예: 만 2세" />
              </Field>
              <Field label="활동유형">
                <input name="activity_type" defaultValue={video.activity_type ?? ""} className={inputCls} placeholder="예: 1인 사물 탐색" />
              </Field>
              <Field label="복잡성 수준">
                <input name="complexity_level" defaultValue={video.complexity_level ?? ""} className={inputCls} placeholder="low / medium / high" />
              </Field>
              <Field label="등장인물 수">
                <input name="actor_count" type="number" min={0} defaultValue={video.actor_count ?? ""} className={inputCls} />
              </Field>
              <Field label="주요 사물 수">
                <input name="object_count" type="number" min={0} defaultValue={video.object_count ?? ""} className={inputCls} />
              </Field>
              <Field label="오디오 포함">
                <select name="has_audio" defaultValue={video.has_audio ? "true" : "false"} className={inputCls}>
                  <option value="true">있음</option>
                  <option value="false">없음</option>
                </select>
              </Field>
              <Field label="정렬 순서">
                <input name="sort_order" type="number" min={0} defaultValue={video.sort_order} className={inputCls} />
              </Field>
              <Field label="활성" hint="구조 잠금 후 연구영상 비활성은 거부됨">
                <select name="active" defaultValue={video.active ? "true" : "false"} className={inputCls}>
                  <option value="true">활성</option>
                  <option value="false">비활성</option>
                </select>
              </Field>
            </div>
            <Field label="관리자 메모">
              <textarea name="description_admin" defaultValue={video.description_admin ?? ""} className={`${inputCls} min-h-24`} />
            </Field>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
