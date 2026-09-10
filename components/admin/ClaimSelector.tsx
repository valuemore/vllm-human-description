"use client";

import { useActionState, useRef, useState } from "react";
import type { ActionState } from "@/components/admin/ActionForm";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * 원문(읽기 전용)에서 텍스트를 드래그 선택해 Claim 으로 추가한다. 원문은 절대 수정되지 않는다.
 * 선택 영역의 문자 offset(char_start/char_end)을 함께 저장한다.
 */
export function ClaimSelector({ text, sessionId, action, disabled }: { text: string; sessionId: string; action: Action; disabled: boolean }) {
  const pre = useRef<HTMLPreElement>(null);
  const [sel, setSel] = useState<{ text: string; start: number; end: number } | null>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  function capture() {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0 || !pre.current) return setSel(null);
    const range = s.getRangeAt(0);
    if (!pre.current.contains(range.commonAncestorContainer)) return setSel(null);
    const selected = s.toString();
    if (!selected.trim()) return setSel(null);
    // pre 안의 텍스트 노드는 단일 문자열이므로 앞 구간 길이로 offset 계산
    const before = range.cloneRange();
    before.selectNodeContents(pre.current);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    setSel({ text: selected, start, end: start + selected.length });
  }

  return (
    <div>
      <pre ref={pre} onMouseUp={capture} onKeyUp={capture} className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-3 font-sans text-sm leading-relaxed select-text" aria-label="원문 (읽기 전용)">
        {text}
      </pre>
      <form action={formAction} className="mt-2 flex items-start gap-2 text-sm">
        <input type="hidden" name="session_id" value={sessionId} />
        <input type="hidden" name="char_start" value={sel?.start ?? ""} />
        <input type="hidden" name="char_end" value={sel?.end ?? ""} />
        <textarea name="text" value={sel?.text ?? ""} onChange={(e) => setSel((p) => ({ text: e.target.value, start: p?.start ?? 0, end: p?.end ?? 0 }))} placeholder="원문에서 드래그하여 선택하거나 직접 입력" className="min-h-16 flex-1 rounded border bg-background px-2 py-1" disabled={disabled} />
        <button type="submit" disabled={disabled || pending || !sel?.text.trim()} className="rounded bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50">
          Claim 추가
        </button>
      </form>
      {state.error && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </div>
  );
}
