"use client";

import { useActionState, type ReactNode } from "react";

export type ActionState = { ok?: boolean; error?: string; pin?: string; code?: string };
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Server Action 폼 래퍼. 결과(오류/PIN 등)를 폼 아래에 표시한다.
 * children 은 필드, submitLabel 은 버튼 문구. confirm 이 있으면 제출 전 확인.
 */
export function ActionForm({
  action, children, submitLabel, confirm, className = "", successMode = "default", baseUrl,
}: {
  action: Action;
  children: ReactNode;
  submitLabel: string;
  confirm?: string;
  className?: string;
  /** pin: 생성/재설정된 PIN 을 1회 표시 (서버 컴포넌트에서 렌더 함수를 넘길 수 없으므로 선언적으로 지정) */
  successMode?: "default" | "pin";
  baseUrl?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form
      action={formAction}
      className={`space-y-3 ${className}`}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/80 disabled:opacity-50">
          {pending ? "처리 중…" : submitLabel}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.ok && successMode === "default" && <p className="text-sm text-emerald-700">완료</p>}
      </div>
      {state.ok && successMode === "pin" && state.pin && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm">
          {state.code && <p className="font-medium">생성됨: {state.code}</p>}
          <p>
            PIN <span className="font-mono text-lg">{state.pin}</span> — 이 값은 다시 표시되지 않습니다. 오프라인 문서에 보관하세요.
          </p>
          {baseUrl && state.code && (
            <p className="mt-1 font-mono text-xs">
              {baseUrl}/enter?code={state.code}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded border bg-background px-2 py-1.5 text-sm";
