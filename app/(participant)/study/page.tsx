import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StepProgress } from "@/components/participant/StepProgress";
import { copy } from "@/lib/copy/participant.ko";
import { guardStep } from "@/lib/participant/guard";

export const dynamic = "force-dynamic";

export default async function StudyHubPage() {
  const { step, snapshot } = await guardStep("study");
  if (step.step !== "study_hub") redirect(step.href);
  const h = copy.hub;
  const justFinishedPractice = snapshot.practice?.status === "submitted" && step.completedCount === 0;

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
