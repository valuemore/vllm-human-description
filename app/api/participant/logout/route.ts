import { handle, ok } from "@/lib/api-response";
import { getParticipantContext } from "@/lib/auth/participant";
import { logoutParticipant } from "@/lib/services/participant-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  await logoutParticipant(await getParticipantContext());
  return ok({ loggedOut: true });
});
