import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/auth/admin";
import { getCurrentStudy, listStudies } from "@/lib/services/admin/study";
import { StatusBadge } from "@/components/admin/ui";
import { adminLogoutAction } from "@/app/admin/login/actions";
import { switchStudyAction } from "./actions";

const NAV = [
  ["/admin/dashboard", "대시보드"],
  ["/admin/participants", "참여자"],
  ["/admin/order-groups", "순서그룹"],
  ["/admin/videos", "영상"],
  ["/admin/observations", "관찰기록"],
  ["/admin/exports", "Export"],
  ["/admin/ai", "AI 기술문"],
  ["/admin/reference", "Reference"],
  ["/admin/coding", "Claim Coding"],
  ["/admin/analysis", "분석"],
  ["/admin/settings", "설정"],
  ["/admin/audit", "감사로그"],
] as const;

export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const { admin } = await requireAdminPage();
  const [study, studies] = await Promise.all([getCurrentStudy(), listStudies()]);
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r bg-background">
        <div className="border-b px-4 py-3">
          <p className="text-xs text-muted-foreground">연구 관리자</p>
          <p className="truncate text-sm font-medium">{admin.email}</p>
        </div>
        <form action={switchStudyAction} className="border-b px-4 py-3">
          <label htmlFor="study-switch" className="text-xs text-muted-foreground">
            연구
          </label>
          <select id="study-switch" name="study_id" defaultValue={study.id} className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm">
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.status}
              </option>
            ))}
          </select>
          <button type="submit" className="mt-2 w-full rounded border px-2 py-1 text-xs hover:bg-muted">
            전환
          </button>
          <div className="mt-2">
            <StatusBadge status={study.status} />
          </div>
        </form>
        <nav className="p-2">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="block rounded px-3 py-2 text-sm hover:bg-muted">
              {label}
            </Link>
          ))}
        </nav>
        <form action={adminLogoutAction} className="p-4">
          <button type="submit" className="w-full rounded border px-2 py-1 text-xs hover:bg-muted">
            로그아웃
          </button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
