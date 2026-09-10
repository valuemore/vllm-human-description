import "server-only";
import { redirect } from "next/navigation";
import { getAdminSessionClient } from "@/lib/db/server-client";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError } from "@/lib/errors";
import type { Database } from "@/types/database";

export type AdminRow = Database["public"]["Tables"]["admin_users"]["Row"];
export type AdminContext = { admin: AdminRow; userId: string };

/** Supabase Auth 세션 + admin_users allowlist(active) 검사. 실패 시 null */
export async function getAdminContext(): Promise<AdminContext | null> {
  const sb = await getAdminSessionClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: admin } = await getServiceClient().from("admin_users").select("*").eq("id", user.id).eq("active", true).maybeSingle();
  if (!admin) return null;
  return { admin, userId: user.id };
}

/** 페이지용: 미인증이면 /admin/login 으로 */
export async function requireAdminPage(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  return ctx;
}

/** Route Handler / Server Action 용: 미인증이면 401 */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new AppError("UNAUTHENTICATED", "관리자 로그인이 필요합니다");
  return ctx;
}
