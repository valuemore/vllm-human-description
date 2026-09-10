import { handle, ok, readJson } from "@/lib/api-response";
import { requireParticipant } from "@/lib/auth/participant";
import { completeFirstWatch } from "@/lib/services/observations";
import { firstWatchCompleteSchema } from "@/lib/validation/observation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireParticipant();
  const { id } = await params;
  const input = firstWatchCompleteSchema.parse(await readJson(req));
  return ok(await completeFirstWatch(ctx, id, input.max_watched_ms));
});
