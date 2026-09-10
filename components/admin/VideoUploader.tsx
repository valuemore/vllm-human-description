"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Meta = { duration_ms: number; width: number | null; height: number | null; has_audio: boolean };

/** 로컬 파일의 메타데이터(duration/해상도)를 <video> 로 읽는다 (서버 ffprobe 없이) */
function readMeta(file: File): Promise<Meta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      const anyV = v as HTMLVideoElement & { mozHasAudio?: boolean; webkitAudioDecodedByteCount?: number; audioTracks?: { length: number } };
      const hasAudio = anyV.mozHasAudio ?? (anyV.audioTracks ? anyV.audioTracks.length > 0 : (anyV.webkitAudioDecodedByteCount ?? 1) > 0);
      resolve({ duration_ms: Math.round(v.duration * 1000), width: v.videoWidth || null, height: v.videoHeight || null, has_audio: !!hasAudio });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("영상 메타데이터를 읽을 수 없습니다"));
    };
    v.src = url;
  });
}

/**
 * Private Storage 직접 업로드 (signed upload URL). Vercel 함수 본문 제한(4.5MB)을 우회한다.
 * 1) 메타 읽기 → 2) upload-url → 3) PUT → 4) finalize(메타 저장 + audit)
 */
export function VideoUploader({ videoId, disabled, replaceWarning }: { videoId: string; disabled?: boolean; replaceWarning?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ phase: "idle" | "reading" | "uploading" | "finalizing" | "done" | "error"; message?: string; progress?: number }>({ phase: "idle" });

  async function onFile(file: File) {
    if (replaceWarning && !window.confirm("기존 영상 파일을 교체합니다. 계속할까요?")) return;
    try {
      setState({ phase: "reading" });
      const meta = await readMeta(file);
      setState({ phase: "uploading", progress: 0 });
      const urlRes = await fetch(`/api/admin/videos/${videoId}/upload-url`, { method: "POST" });
      const urlBody = await urlRes.json();
      if (!urlBody.ok) throw new Error(urlBody.message ?? "업로드 URL 발급 실패");
      await putWithProgress(urlBody.data.signedUrl, file, (p) => setState({ phase: "uploading", progress: p }));
      setState({ phase: "finalizing" });
      const finRes = await fetch(`/api/admin/videos/${videoId}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...meta, file_size: file.size, mime_type: file.type || "video/mp4" }),
      });
      const finBody = await finRes.json();
      if (!finBody.ok) throw new Error(finBody.message ?? "메타 저장 실패");
      setState({ phase: "done", message: `완료 (${(meta.duration_ms / 1000).toFixed(1)}초)` });
      router.refresh();
    } catch (e) {
      setState({ phase: "error", message: (e as Error).message });
    }
  }

  const busy = state.phase === "reading" || state.phase === "uploading" || state.phase === "finalizing";
  return (
    <div className="text-sm">
      <label className={`inline-block cursor-pointer rounded border px-3 py-1.5 hover:bg-muted ${disabled || busy ? "pointer-events-none opacity-50" : ""}`}>
        {replaceWarning ? "파일 교체" : "파일 업로드"}
        <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={disabled || busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {state.phase === "reading" && <span className="ml-2 text-muted-foreground">메타데이터 읽는 중…</span>}
      {state.phase === "uploading" && <span className="ml-2 text-muted-foreground">업로드 {Math.round((state.progress ?? 0) * 100)}%</span>}
      {state.phase === "finalizing" && <span className="ml-2 text-muted-foreground">저장 중…</span>}
      {state.phase === "done" && <span className="ml-2 text-emerald-700">{state.message}</span>}
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
