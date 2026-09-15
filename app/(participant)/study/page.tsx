import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StepProgress } from "@/components/participant/StepProgress";
import { copy } from "@/lib/copy/participant.ko";
import { guardStep } from "@/lib/participant/guard";
import { totalRemainingSeconds } from "@/lib/participant/timeLimits";
import { formatClock } from "@/lib/timer/timerMath";

export const dynamic = "force-dynamic";

export default async function StudyHubPage() {
  const { ctx, step, snapshot } = await guardStep("study");
  if (step.step !== "study_hub") redirect(step.href);
  const h = copy.hub;
  const justFinishedPractice = snapshot.practice?.status === "submitted" && step.completedCount === 0;
  // 전체 제한시간 안내 (서버 시각 기준 정적 표시). 마감은 첫 본 관찰 시작 시 확정된다.
  const totalLimit = ctx.study.total_time_limit_seconds;
  const totalRemaining = totalRemainingSeconds(ctx.participant.main_deadline_at);
  const totalLine =
    totalLimit === null
      ? null
      : totalRemaining === null
        ? h.totalNotStarted(Math.round(totalLimit / 60))
        : totalRemaining <= 0
          ? h.totalExpired
          : `${h.totalRemaining(formatClock(totalRemaining))} · ${h.totalRemainingHint}`;
  const totalWarn = totalRemaining !== null && totalRemaining > 0 && totalRemaining <= 300;

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold" tabIndex={-1}>
        {h.title}
      </h1>
      {justFinishedPractice && <p className="mt-3 text-sky-900">{h.afterPractice}</p>}
      <p className="mt-3 text-neutral-700">{h.lead(step.totalCount)}</p>
      <div className="mt-6">
        <StepProgress completed={step.completedCount} total={step.totalCount} />
      </div>
      {totalLine && (
        <p role="status" className={`mt-4 rounded-lg px-4 py-2 ${totalWarn ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-800"}`}>
          {totalLine}
        </p>
      )}
      {step.nextObservationId ? (
        <>
          <p className="mt-6 text-neutral-600">{h.note}</p>
          <Link href={`/study/${step.nextObservationId}`} className={cn(buttonVariants({ size: "lg" }), "mt-6 h-12 w-full text-base")}>
            {h.start(step.nextOrder)}
          </Link>
        </>
      ) : (
        <p role="alert" className="mt-6 text-red-800">
          {h.empty}
        </p>
      )}
    </section>
  );
}
