import { handle, ok, readJson } from "@/lib/api-response";
import { requireParticipant } from "@/lib/auth/participant";
import { recordDevice } from "@/lib/services/participant-onboarding";
import { deviceCheckSchema } from "@/lib/validation/participant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const ctx = await requireParticipant();
  const result = await recordDevice(ctx, deviceCheckSchema.parse(await readJson(req)));
  return ok(result);
});
