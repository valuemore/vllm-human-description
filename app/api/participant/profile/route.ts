import { handle, ok, readJson } from "@/lib/api-response";
import { requireParticipant } from "@/lib/auth/participant";
import { saveProfile } from "@/lib/services/participant-onboarding";
import { profileSchema } from "@/lib/validation/participant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const ctx = await requireParticipant();
  await saveProfile(ctx, profileSchema.parse(await readJson(req)));
  return ok({ next: "/guide" });
});
