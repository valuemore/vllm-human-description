import type { ReactNode } from "react";

/** /admin/login 은 인증 전 화면이므로 여기서는 공통 셸만 제공한다. 인가는 (protected)/layout 에서 수행. */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-muted/30">{children}</div>;
}
