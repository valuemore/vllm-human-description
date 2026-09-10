import { redirect } from "next/navigation";
import { ObservationShell } from "@/components/participant/ObservationShell";
import { guardStep } from "@/lib/participant/guard";
import { getObservationSnapshot } from "@/lib/services/observations";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const { ctx, step } = await guardStep("practice");
  if (step.step !== "practice") redirect(step.href);
  const snapshot = await getObservationSnapshot(ctx, step.observationId);
  if (snapshot.status === "submitted") redirect("/study");
  return <ObservationShell snapshot={snapshot} mode="practice" />;
}
