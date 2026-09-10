"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminSessionClient } from "@/lib/db/server-client";
import { getServiceClient } from "@/lib/db/service-client";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  next: z.string().optional(),
});

export type LoginState = { error?: string };

export async function adminLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "이메일과 비밀번호를 확인해 주세요." };
  const sb = await getAdminSessionClient();
  const { data, error } = await sb.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return { error: "로그인할 수 없습니다. 이메일과 비밀번호를 확인해 주세요." };
  const { data: admin } = await getServiceClient().from("admin_users").select("id").eq("id", data.user.id).eq("active", true).maybeSingle();
  if (!admin) {
    await sb.auth.signOut();
    return { error: "관리자 권한이 없는 계정입니다." };
  }
  const next = parsed.data.next && parsed.data.next.startsWith("/admin") ? parsed.data.next : "/admin/dashboard";
  redirect(next);
}

export async function adminLogoutAction() {
  const sb = await getAdminSessionClient();
  await sb.auth.signOut();
  redirect("/admin/login");
}
