"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isHevc, probeVideoBytes } from "@/lib/video-probe";

type Meta = { duration_ms: number; width: number | null; height: number | null; has_audio: boolean };
type MetaResult = Meta & { warning?: string };

/**
 * <video> 요소로 오디오 트랙 유무를 판정한다 (컨테이너 프로브가 실패했을 때의 보조 수단).
 * - Firefox: mozHasAudio, Safari: audioTracks 는 metadata 단계에서 신뢰할 수 있다.
 * - Chromium: webkitAudioDecodedByteCount 는 실제로 디코딩이 진행돼야 증가하므로 음소거 상태로 잠깐 재생한 뒤 읽는다.
 * - 어떤 API 도 없으면 true (오디오 있음) 로 간주한다. 관리자가 상세 화면에서 수정할 수 있다.
 */
async function detectAudioByElement(v: HTMLVideoElement): Promise<boolean> {
  const anyV = v as HTMLVideoElement & { mozHasAudio?: boolean; webkitAudioDecodedByteCount?: number; audioTracks?: { length: number } };
  if (typeof anyV.mozHasAudio === "boolean") return anyV.mozHasAudio;
  if (anyV.audioTracks) return anyV.audioTracks.length > 0;
  if (typeof anyV.webkitAudioDecodedByteCount !== "number") return true;
  try {
    v.muted = true;
    await v.play();
  } catch {
    return true;
  }
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    if ((anyV.webkitAudioDecodedByteCount ?? 0) > 0) break;
    if (v.currentTime > 1) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  v.pause();
  return (anyV.webkitAudioDecodedByteCount ?? 0) > 0;
}

/** 로컬 파일의 메타데이터(duration/해상도/오디오)를 <video> + 컨테이너 프로브로 읽는다 (서버 ffprobe 없이) */
async function readMeta(file: File): Promise<MetaResult> {
  const probe = probeVideoBytes(new Uint8Array(await file.arrayBuffer()));
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.preload = "auto";
  v.muted = true;
  try {
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error("영상 메타데이터를 읽을 수 없습니다"));
      v.src = url;
    });
    const has_audio = probe.hasAudio ?? (await detectAudioByElement(v));
    const warning = isHevc(probe) ? `HEVC(H.265) 코덱이 감지되었습니다 (${probe.videoCodecs.join(", ")}). 하드웨어 디코더가 없는 Windows PC 의 Chrome/Firefox 에서는 재생되지 않을 수 있으니 H.264(avc1) 로 다시 인코딩하는 것을 권장합니다.` : undefined;
    return { duration_ms: Math.round(v.duration * 1000), width: v.videoWidth || null, height: v.videoHeight || null, has_audio, warning };
  } finally {
    v.pause();
    v.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

/**
 * Private Storage 직접 업로드 (signed upload URL). Vercel 함수 본문 제한(4.5MB)을 우회한다.
 * 1) 메타 읽기 → 2) upload-url → 3) PUT → 4) finalize(메타 저장 + audit)
 */
const REPLACE_REASON_MIN = 5;

/**
 * submittedCount > 0 이면 제출된 관찰기록이 있는 영상이다. 이 경우 교체 사유(필수)를 받아 서버에 보내고,
 * 서버는 기존 파일을 백업한 뒤 덮어쓰며 감사 로그에 사유·백업 경로를 남긴다.
 */
export function VideoUploader({ videoId, disabled, replaceWarning, submittedCount = 0 }: { videoId: string; disabled?: boolean; replaceWarning?: boolean; submittedCount?: number }) {
  const router = useRouter();
  const [state, setState] = useState<{ phase: "idle" | "reading" | "uploading" | "finalizing" | "done" | "error"; message?: string; progress?: number; warning?: string }>({ phase: "idle" });
  const [reason, setReason] = useState("");
  const requiresReason = !!replaceWarning && submittedCount > 0;
  const reasonOk = !requiresReason || reason.trim().length >= REPLACE_REASON_MIN;

  async function onFile(file: File) {
    const confirmText = requiresReason
      ? `이 영상에는 제출된 관찰기록이 ${submittedCount}건 있습니다. 기존 파일은 백업으로 보존되고 새 파일로 교체되며, 사유가 감사 로그에 기록됩니다. 계속할까요?`
      : "기존 영상 파일을 교체합니다. 계속할까요?";
    if (replaceWarning && !window.confirm(confirmText)) return;
    try {
      setState({ phase: "reading" });
      const { warning, ...meta } = await readMeta(file);
      setState({ phase: "uploading", progress: 0 });
      const replaceBody = requiresReason ? { replace_reason: reason.trim() } : {};
      const urlRes = await fetch(`/api/admin/videos/${videoId}/upload-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(replaceBody),
      });
      const urlBody = await urlRes.json();
      if (!urlBody.ok) throw new Error(urlBody.message ?? "업로드 URL 발급 실패");
      await putWithProgress(urlBody.data.signedUrl, file, (p) => setState({ phase: "uploading", progress: p }));
      setState({ phase: "finalizing" });
      const finRes = await fetch(`/api/admin/videos/${videoId}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...meta, file_size: file.size, mime_type: file.type || "video/mp4", ...replaceBody, backup_path: urlBody.data.backupPath ?? undefined }),
      });
      const finBody = await finRes.json();
      if (!finBody.ok) throw new Error(finBody.message ?? "메타 저장 실패");
      const backupNote = urlBody.data.backupPath ? ` · 기존 파일 백업: ${urlBody.data.backupPath}` : "";
      setState({ phase: "done", message: `완료 (${(meta.duration_ms / 1000).toFixed(1)}초, 오디오 ${meta.has_audio ? "있음" : "없음"})${backupNote}`, warning });
      setReason("");
      router.refresh();
    } catch (e) {
      setState({ phase: "error", message: (e as Error).message });
    }
  }

  const busy = state.phase === "reading" || state.phase === "uploading" || state.phase === "finalizing";
  const blocked = disabled || busy || !reasonOk;
  return (
    <div className="text-sm">
      {requiresReason && (
        <div className="mb-2">
          <label htmlFor={`replace-reason-${videoId}`} className="block text-xs text-muted-foreground">
            교체 사유 (필수, {REPLACE_REASON_MIN}자 이상) — 제출 기록 {submittedCount}건이 있는 영상입니다. 같은 영상의 재인코딩처럼 자극물 내용이 바뀌지 않는 경우에만 교체하세요.
          </label>
          <input
            id={`replace-reason-${videoId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={disabled || busy}
            placeholder="예: HEVC → H.264 재인코딩 (내용 동일)"
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </div>
      )}
      <label className={`inline-block cursor-pointer rounded border px-3 py-1.5 hover:bg-muted ${blocked ? "pointer-events-none opacity-50" : ""}`}>
        {replaceWarning ? "파일 교체" : "파일 업로드"}
        <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={blocked} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {state.phase === "reading" && <span className="ml-2 text-muted-foreground">메타데이터 읽는 중…</span>}
      {state.phase === "uploading" && <span className="ml-2 text-muted-foreground">업로드 {Math.round((state.progress ?? 0) * 100)}%</span>}
      {state.phase === "finalizing" && <span className="ml-2 text-muted-foreground">저장 중…</span>}
      {state.phase === "done" && <span className="ml-2 text-emerald-700">{state.message}</span>}
      {state.phase === "done" && state.warning && (
        <p role="alert" className="mt-2 text-amber-700">
          {state.warning}
        </p>
      )}
      {state.phase === "error" && (
        <span role="alert" className="ml-2 text-red-700">
          {state.message}
        </span>
      )}
    </div>
  );
}

function putWithProgress(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "video/mp4");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`업로드 실패 (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("업로드 네트워크 오류"));
    xhr.send(file);
  });
}
