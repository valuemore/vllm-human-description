import { fail, handle, ok } from "@/lib/api-response";
import { getServiceClient } from "@/lib/db/service-client";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel Cron(스케줄은 vercel.json; Hobby 플랜은 매일 1회 제한): 클라이언트가 사라진 만료 관찰을 timeout 제출로 마감한다. 참여자 요청 경로에서는 즉시 마감되므로 이 잡은 안전망이다. */
export const GET = handle(async (req: Request) => {
  const secret = getEnv().CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return fail("UNAUTHENTICATED", "unauthorized", 401);
  const { data, error } = await getServiceClient().rpc("finalize_expired_observations", {});
  if (error) return fail("INTERNAL", error.message, 500);
  return ok({ finalized: data ?? 0 });
});
