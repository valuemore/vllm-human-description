/** 자동저장 순수 로직: 로컬/서버 초안 조정, 백오프 일정 */
export type DraftRecord = { text: string; revision: number; updatedAt?: string };

export type ReconcileInput = {
  server: { text: string; revision: number; submitted: boolean };
  local: DraftRecord | null;
};

export type ReconcileResult = {
  text: string;
  revision: number;
  source: "server" | "local" | "submitted";
  /** 로컬 초안이 더 최신이라 서버에 즉시 저장해야 하는지 */
  pushToServer: boolean;
  /** 로컬 캐시를 폐기해야 하는지 */
  discardLocal: boolean;
};

export function reconcileDraft({ server, local }: ReconcileInput): ReconcileResult {
  if (server.submitted) return { text: server.text, revision: server.revision, source: "submitted", pushToServer: false, discardLocal: true };
  if (local && local.revision > server.revision) {
    return { text: local.text, revision: local.revision, source: "local", pushToServer: true, discardLocal: false };
  }
  return { text: server.text, revision: server.revision, source: "server", pushToServer: false, discardLocal: false };
}

export const AUTOSAVE_DEBOUNCE_MS = 3000;
export const AUTOSAVE_MAX_WAIT_MS = 10_000;
export const AUTOSAVE_BACKOFF_MS = [1000, 2000, 4000, 8000, 15_000] as const;

export function backoffDelay(attempt: number): number {
  const idx = Math.max(0, Math.min(attempt, AUTOSAVE_BACKOFF_MS.length - 1));
  return AUTOSAVE_BACKOFF_MS[idx];
}

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "offline";
