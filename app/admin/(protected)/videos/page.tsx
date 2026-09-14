import Link from "next/link";
import { ActionForm, Field, inputCls } from "@/components/admin/ActionForm";
import { VideoUploader } from "@/components/admin/VideoUploader";
import { Notice, PageHeader, Section, Table, Td } from "@/components/admin/ui";
import { getCurrentStudy, getTargets } from "@/lib/services/admin/study";
import { listVideos } from "@/lib/services/admin/videos";
import { formatDurationKo, isOutsideRecommendedRange, MAX_RESEARCH_VIDEO_MS, MIN_RESEARCH_VIDEO_MS } from "@/lib/video-limits";
import { createVideoAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const study = await getCurrentStudy();
  const [videos, targets] = await Promise.all([listVideos(study.id), getTargets(study.id)]);
  const research = videos.filter((v) => v.kind === "research" && v.active);
  const locked = !!study.structure_locked_at;
  const nextCode = `V${String(research.length + 1).padStart(2, "0")}`;

  return (
    <>
      <PageHeader title="영상 관리" description={`연구영상 ${research.length} / ${targets.video_count}편 (파일 등록 ${research.filter((v) => v.storage_path).length}) · Private Storage · signed URL 전용`} />
      {research.length !== targets.video_count && !locked && <Notice tone="warn">활성 연구영상 수가 설정 편수({targets.video_count})와 다릅니다. 맞춘 뒤 순서그룹을 재생성하세요.</Notice>}
      {locked && <Notice tone="info">구조 잠김: 연구영상 추가·비활성은 불가합니다. 메타데이터 수정과 연습영상 관리는 가능합니다.</Notice>}
      {research.some((v) => v.duration_ms && isOutsideRecommendedRange(v.duration_ms)) && (
        <Notice tone="warn">
          {formatDurationKo(MIN_RESEARCH_VIDEO_MS)}~{formatDurationKo(MAX_RESEARCH_VIDEO_MS)} 범위를 벗어난 연구영상이 있습니다 (권장 길이, 최대 {formatDurationKo(MAX_RESEARCH_VIDEO_MS)}).
        </Notice>
      )}

      <Section title="영상 등록 (placeholder → 파일 업로드)">
        <ActionForm action={createVideoAction} submitLabel="등록">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="코드" hint="연구영상 V01.., 연습영상 P01">
              <input name="code" defaultValue={nextCode} className={inputCls} required />
            </Field>
            <Field label="구분">
              <select name="kind" className={inputCls} defaultValue="research" disabled={locked && false}>
                <option value="research">research (연구영상)</option>
                <option value="practice">practice (연습영상)</option>
              </select>
            </Field>
            <Field label="관리자용 제목">
              <input name="title" className={inputCls} required />
            </Field>
          </div>
        </ActionForm>
      </Section>

      <Section title="영상 목록">
        <Table head={["코드", "구분", "제목", "길이", "해상도", "오디오", "파일", "제출 기록", "활성", "업로드", ""]}>
          {videos.map((v) => (
            <tr key={v.id} className={!v.active ? "text-muted-foreground" : ""}>
              <Td mono>{v.code}</Td>
              <Td>{v.kind}</Td>
              <Td>{v.title_admin}</Td>
              <Td mono>{v.duration_ms ? `${(v.duration_ms / 1000).toFixed(1)}s` : "—"}</Td>
              <Td mono>{v.width ? `${v.width}×${v.height}` : "—"}</Td>
              <Td>{v.has_audio ? "있음" : "없음"}</Td>
              <Td>{v.storage_path ? <span className="text-emerald-700">등록</span> : <span className="text-amber-700">없음</span>}</Td>
              <Td mono>{v.submitted_count}</Td>
              <Td>{v.active ? "✓" : "—"}</Td>
              <Td>
                <VideoUploader videoId={v.id} replaceWarning={!!v.storage_path} disabled={v.submitted_count > 0 && !!v.storage_path} />
              </Td>
              <Td>
                <Link className="underline" href={`/admin/videos/${v.id}`}>
                  상세
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
