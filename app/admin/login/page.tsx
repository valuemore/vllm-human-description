import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/admin";
import { AdminLoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getAdminContext()) redirect(next && next.startsWith("/admin") ? next : "/admin/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm rounded-xl border bg-background p-8 shadow-sm">
        <h1 className="text-xl font-semibold">연구 관리자 로그인</h1>
        <p className="mt-1 text-sm text-muted-foreground">등록된 관리자 계정으로만 접근할 수 있습니다.</p>
        <AdminLoginForm next={next} />
      </div>
    </main>
  );
}
