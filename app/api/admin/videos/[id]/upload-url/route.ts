import { z } from "zod";
import { handle, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/admin";
import { createUploadUrl } from "@/lib/services/admin/videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ replace_reason: z.string().max(500).optional() });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await params;
  // 본문은 선택 (기존 호출은 본문 없이 POST)
  const raw = await req.text();
  const input = raw ? schema.parse(JSON.parse(raw)) : {};
  return ok(await createUploadUrl(id, { replaceReason: input.replace_reason ?? null }));
});
