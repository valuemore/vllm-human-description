import type { ReactNode } from "react";
import { copy } from "@/lib/copy/participant.ko";

/** 참여자 공통 셸: 좁은 폭, 큰 글자, 차분한 톤. 인가는 각 page 의 guardStep 이 담당한다. */
export default function ParticipantLayout({ children }: { children: ReactNode }) {
  return (
    <div className="participant-shell flex min-h-screen flex-col bg-[#f7f7f5] text-[17px] leading-[1.7] text-neutral-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        {copy.common.skipToMain}
      </a>
      <header className="border-b bg-white/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-5 text-sm text-neutral-600">{copy.app.title}</div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
        {children}
      </main>
    </div>
  );
}
