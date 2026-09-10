import { handle, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/admin";
import { createUploadUrl } from "@/lib/services/admin/videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await params;
  return ok(await createUploadUrl(id));
});
