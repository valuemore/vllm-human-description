"use client";

import { AlertCircle, Check, CloudOff, Loader2 } from "lucide-react";
import type { AutosaveStatus as Status } from "@/lib/autosave/draftReconcile";
import { copy } from "@/lib/copy/participant.ko";

export function AutosaveStatus({ status, lastSavedAt }: { status: Status; lastSavedAt: Date | null }) {
  const a = copy.observation.autosave;
  const time = lastSavedAt ? lastSavedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "";
  const map: Record<Status, { text: string; icon: React.ReactNode; cls: string }> = {
    idle: { text: "", icon: null, cls: "text-neutral-500" },
    dirty: { text: a.dirty, icon: null, cls: "text-neutral-500" },
    saving: { text: a.saving, icon: <Loader2 className="size-4 animate-spin" aria-hidden="true" />, cls: "text-neutral-600" },
    saved: { text: a.saved(time), icon: <Check className="size-4" aria-hidden="true" />, cls: "text-emerald-700" },
    error: { text: a.error, icon: <AlertCircle className="size-4" aria-hidden="true" />, cls: "text-red-700" },
    offline: { text: a.offline, icon: <CloudOff className="size-4" aria-hidden="true" />, cls: "text-amber-800" },
  };
  const m = map[status];
  return (
    <p role="status" aria-live="polite" className={`flex min-h-6 items-center gap-1.5 text-sm ${m.cls}`}>
      {m.icon}
      <span>{m.text}</span>
    </p>
  );
}
