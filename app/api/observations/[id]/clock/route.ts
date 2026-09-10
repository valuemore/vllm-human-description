import { handle, ok } from "@/lib/api-response";
import { requireParticipant } from "@/lib/auth/participant";
import { getClock } from "@/lib/services/observations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireParticipant();
  const { id } = await params;
  return ok(await getClock(ctx, id));
});
