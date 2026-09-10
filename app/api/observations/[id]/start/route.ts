import { handle, ok, readJson } from "@/lib/api-response";
import { requireParticipant } from "@/lib/auth/participant";
import { startObservation } from "@/lib/services/observations";
import { startSchema } from "@/lib/validation/observation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireParticipant();
  const { id } = await params;
  const input = startSchema.parse(await readJson(req));
  return ok(await startObservation(ctx, id, input.client_elapsed_ms_since_play));
});
