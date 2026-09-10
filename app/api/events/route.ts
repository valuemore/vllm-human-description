import { handle, ok, readJson } from "@/lib/api-response";
import { requireParticipant } from "@/lib/auth/participant";
import { ingestEvents } from "@/lib/services/observations";
import { eventBatchSchema } from "@/lib/validation/observation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 이벤트 배치 수집. sendBeacon(text/plain) 과 fetch(json) 모두 허용. */
export const POST = handle(async (req: Request) => {
  const ctx = await requireParticipant();
  const batch = eventBatchSchema.parse(await readJson(req));
  return ok(await ingestEvents(ctx, batch));
});
