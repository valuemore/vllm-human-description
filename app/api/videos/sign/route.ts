import { handle, ok, readJson } from "@/lib/api-response";
import { requireParticipant } from "@/lib/auth/participant";
import { signVideoForObservation } from "@/lib/services/videos";
import { signVideoSchema } from "@/lib/validation/observation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const ctx = await requireParticipant();
  const input = signVideoSchema.parse(await readJson(req));
  return ok(await signVideoForObservation(ctx, input.observation_id));
});
