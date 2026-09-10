"use client";

/** 영상 위 반복 워터마크 (연구참여용 T07). 상호작용 없음, 보조기기에는 숨김. */
export function WatermarkOverlay({ text }: { text: string }) {
  const cells = Array.from({ length: 12 });
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid select-none grid-cols-3 grid-rows-4 overflow-hidden">
      {cells.map((_, i) => (
        <span
          key={i}
          className="flex items-center justify-center whitespace-nowrap text-sm font-semibold tracking-wide text-white/40 mix-blend-difference"
          style={{ transform: "rotate(-24deg)" }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
