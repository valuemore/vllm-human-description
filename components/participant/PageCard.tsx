"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** 온보딩 화면 공통 카드. 진입 시 제목에 포커스를 주어 화면 전환을 스크린리더에 알린다. */
export function PageCard({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h1.current?.focus();
  }, []);
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 shadow-sm">
      <h1 ref={h1} tabIndex={-1} className="text-2xl font-semibold leading-snug outline-none">
        {title}
      </h1>
      {lead && <p className="mt-3 text-neutral-700">{lead}</p>}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

export function ErrorText({ children, id }: { children: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-[15px] text-red-800">
      <span aria-hidden="true">⚠</span>
      <span>{children}</span>
    </p>
  );
}
