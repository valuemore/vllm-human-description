import { handle, ok } from "@/lib/api-response";
import { requireParticipant } from "@/lib/auth/participant";
import { getParticipantState } from "@/lib/services/participant-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const ctx = await requireParticipant();
  return ok(await getParticipantState(ctx));
});
