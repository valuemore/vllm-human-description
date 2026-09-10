import { Check } from "lucide-react";
import { copy } from "@/lib/copy/participant.ko";

/** 관찰 진행 표시. 내부 영상코드는 노출하지 않는다. */
export function StepProgress({ completed, total }: { completed: number; total: number }) {
  return (
    <div>
      <p className="text-sm text-neutral-600">{copy.hub.progress(completed, total)}</p>
      <ol className="mt-2 flex gap-2" aria-label={copy.hub.progress(completed, total)}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const done = n <= completed;
          const current = n === completed + 1;
          return (
            <li
              key={n}
              className={`flex size-10 items-center justify-center rounded-full border text-base font-medium ${
                done ? "border-emerald-600 bg-emerald-600 text-white" : current ? "border-sky-600 text-sky-700" : "border-neutral-300 text-neutral-500"
              }`}
              aria-current={current ? "step" : undefined}
              aria-label={`${n}번째 관찰${done ? " 완료" : current ? " 진행 예정" : ""}`}
            >
              {done ? <Check className="size-5" aria-hidden="true" /> : n}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
