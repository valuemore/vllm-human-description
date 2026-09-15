import { z } from "zod";
import { handle, ok, readJson } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/admin";
import { finalizeUpload } from "@/lib/services/admin/videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  duration_ms: z.number().int().min(1),
  width: z.number().int().min(1).nullable(),
  height: z.number().int().min(1).nullable(),
  file_size: z.number().int().min(1).nullable(),
  mime_type: z.string().min(3).max(100),
  has_audio: z.boolean(),
  replace_reason: z.string().max(500).optional(),
  backup_path: z.string().max(300).optional(),
});

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { admin } = await requireAdmin();
  const { id } = await params;
  const input = schema.parse(await readJson(req));
  const video = await finalizeUpload(
    id,
    { durationMs: input.duration_ms, width: input.width, height: input.height, fileSize: input.file_size, mimeType: input.mime_type, hasAudio: input.has_audio },
    admin.id,
    { replaceReason: input.replace_reason ?? null, backupPath: input.backup_path ?? null },
  );
  return ok({ id: video.id, storage_path: video.storage_path, duration_ms: video.duration_ms });
});
