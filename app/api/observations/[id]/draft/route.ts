import { handle, ok, readJson } from "@/lib/api-response";
import { requireParticipant } from "@/lib/auth/participant";
import { saveDraft } from "@/lib/services/observations";
import { draftSchema } from "@/lib/validation/observation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const save = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireParticipant();
  const { id } = await params;
  const input = draftSchema.parse(await readJson(req));
  return ok(await saveDraft(ctx, id, input.text, input.revision));
});

export const PUT = save;
/** sendBeacon 은 POST 만 가능 */
export const POST = save;
