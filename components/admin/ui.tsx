import type { ReactNode } from "react";

/** 관리자 화면 공통 프리미티브: 데이터 상태 확인 우선, 장식 최소. */

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "warn" | "bad" | "neutral" }) {
  const ring = tone === "ok" ? "border-emerald-300" : tone === "warn" ? "border-amber-300" : tone === "bad" ? "border-red-300" : "border-border";
  return (
    <div className={`rounded-lg border bg-background p-4 ${ring}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-8 rounded-lg border bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  const isEmpty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="border-b px-2 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={head.length} className="px-2 py-6 text-center text-muted-foreground">
                {empty ?? "데이터가 없습니다"}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "", mono = false }: { children: ReactNode; className?: string; mono?: boolean }) {
  return <td className={`border-b px-2 py-2 align-top ${mono ? "font-mono tabular-nums" : ""} ${className}`}>{children}</td>;
}

const STATUS_STYLE: Record<string, string> = {
  invited: "bg-neutral-100 text-neutral-700",
  consented: "bg-sky-100 text-sky-800",
  onboarding: "bg-sky-100 text-sky-800",
  practice_completed: "bg-sky-100 text-sky-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  withdrawn: "bg-red-100 text-red-800",
  technical_issue: "bg-red-100 text-red-800",
  pending: "bg-neutral-100 text-neutral-700",
  submitted: "bg-emerald-100 text-emerald-800",
  invalidated: "bg-red-100 text-red-800",
  draft: "bg-neutral-100 text-neutral-700",
  pilot: "bg-sky-100 text-sky-800",
  ready: "bg-sky-100 text-sky-800",
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  closed: "bg-neutral-200 text-neutral-800",
  archived: "bg-neutral-200 text-neutral-800",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-neutral-100"}`}>{status}</span>;
}

export function PassBadge({ pass, label }: { pass: boolean; label?: string }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${pass ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
      {label ?? (pass ? "PASS" : "FAIL")}
    </span>
  );
}

export function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("ko-KR", { hour12: false });
}

export function fmtSec(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Math.round(Number(v))}초`;
}

export function Notice({ tone, children }: { tone: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const cls = { info: "bg-sky-50 text-sky-900 border-sky-200", warn: "bg-amber-50 text-amber-900 border-amber-200", error: "bg-red-50 text-red-900 border-red-200", ok: "bg-emerald-50 text-emerald-900 border-emerald-200" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`mb-4 rounded-md border px-3 py-2 text-sm ${cls}`}>
      {children}
    </div>
  );
}
