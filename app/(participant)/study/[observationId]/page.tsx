import { notFound, redirect } from "next/navigation";
import { ObservationShell } from "@/components/participant/ObservationShell";
import { guardStep } from "@/lib/participant/guard";
import { getObservationSnapshot } from "@/lib/services/observations";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function ObservationPage({ params }: { params: Promise<{ observationId: string }> }) {
  const { observationId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(observationId)) notFound();
  const { ctx, step } = await guardStep("observation", observationId);
  let snapshot;
  try {
    snapshot = await getObservationSnapshot(ctx, observationId);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  if (snapshot.status === "submitted" || snapshot.status === "invalidated") redirect(step.href === `/study/${observationId}` ? "/study" : step.href);
  return <ObservationShell snapshot={snapshot} mode="main" />;
}
