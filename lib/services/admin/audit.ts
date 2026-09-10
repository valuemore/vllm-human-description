import "server-only";
import { getServiceClient } from "@/lib/db/service-client";
import { fromDbError } from "@/lib/errors";
import type { Database, Json } from "@/types/database";

export type AuditAction = Database["public"]["Enums"]["audit_action"];

export async function listAuditLogs(studyId: string, opts: { action?: AuditAction; targetType?: string; limit?: number } = {}) {
  let q = getServiceClient()
    .from("audit_logs")
    .select("id, admin_id, action, target_type, target_id, before_json, after_json, created_at, admin:admin_users(email)")
    .eq("study_id", studyId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.action) q = q.eq("action", opts.action);
  if (opts.targetType) q = q.eq("target_type", opts.targetType);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function recordAudit(input: { studyId: string | null; adminId: string; action: AuditAction; targetType: string; targetId?: string | null; before?: unknown; after?: unknown }) {
  const { error } = await getServiceClient().rpc("record_audit", {
    p_study_id: (input.studyId ?? null) as unknown as string,
    p_admin_id: input.adminId,
    p_action: input.action,
    p_target_type: input.targetType,
    p_target_id: (input.targetId ?? null) as unknown as string,
    p_before: (input.before ?? null) as Json,
    p_after: (input.after ?? null) as Json,
  });
  if (error) throw fromDbError(error);
}
