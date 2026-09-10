import { handle, ok, readJson } from "@/lib/api-response";
import { requireParticipant } from "@/lib/auth/participant";
import { submitObservation } from "@/lib/services/observations";
import { submitSchema } from "@/lib/validation/observation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireParticipant();
  const { id } = await params;
  const input = submitSchema.parse(await readJson(req));
  return ok(await submitObservation(ctx, id, { submissionType: input.submission_type, text: input.text, revision: input.revision }));
});
