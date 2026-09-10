import { handle, ok, readJson } from "@/lib/api-response";
import { loginParticipant } from "@/lib/services/participant-auth";
import { enterSchema } from "@/lib/validation/participant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const input = enterSchema.parse(await readJson(req));
  const result = await loginParticipant(input);
  return ok(result);
});
