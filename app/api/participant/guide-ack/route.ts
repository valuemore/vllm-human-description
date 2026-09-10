import { handle, ok } from "@/lib/api-response";
import { requireParticipant } from "@/lib/auth/participant";
import { acknowledgeGuide } from "@/lib/services/participant-onboarding";
import { getParticipantState } from "@/lib/services/participant-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  const ctx = await requireParticipant();
  await acknowledgeGuide(ctx);
  const state = await getParticipantState({ ...ctx, participant: { ...ctx.participant, guide_acknowledged_at: new Date().toISOString() } });
  return ok({ next: state.step.href, step: state.step });
});
