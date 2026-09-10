"use client";

import { useRef, useState } from "react";

/** Reference Annotation 용 플레이어: 현재 위치를 start/end 입력에 복사한다. */
export function ReferencePlayer({ src }: { src: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(0);
  const fill = (name: "start" | "end") => {
    const v = ref.current;
    if (!v) return;
    const el = document.querySelector<HTMLInputElement>(`#new-event input[name="${name}"]`);
    if (el) el.value = String(Math.round(v.currentTime * 1000));
  };
  const step = (ms: number) => {
    const v = ref.current;
    if (v) v.currentTime = Math.max(0, v.currentTime + ms / 1000);
  };
  if (!src) return <p className="text-sm text-muted-foreground">영상 파일이 없습니다.</p>;
  return (
    <div>
      <video ref={ref} src={src} controls controlsList="nodownload" preload="metadata" className="w-full rounded bg-black" onTimeUpdate={() => setNow(ref.current?.currentTime ?? 0)} />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono">{now.toFixed(2)}s ({Math.round(now * 1000)} ms)</span>
        <button type="button" className="rounded border px-2 py-1 hover:bg-muted" onClick={() => step(-100)}>
          −0.1s
        </button>
        <button type="button" className="rounded border px-2 py-1 hover:bg-muted" onClick={() => step(100)}>
          +0.1s
        </button>
        <button type="button" className="rounded border px-2 py-1 hover:bg-muted" onClick={() => fill("start")}>
          현재 → 시작
        </button>
        <button type="button" className="rounded border px-2 py-1 hover:bg-muted" onClick={() => fill("end")}>
          현재 → 종료
        </button>
      </div>
    </div>
  );
}
