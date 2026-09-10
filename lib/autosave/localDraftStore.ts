import type { DraftRecord } from "@/lib/autosave/draftReconcile";

const key = (observationId: string) => `obs-draft:${observationId}`;

/** 오프라인·강제종료 대비 로컬 초안 캐시. localStorage 접근 실패는 조용히 무시한다. */
export const localDraftStore = {
  read(observationId: string): DraftRecord | null {
    try {
      const raw = window.localStorage.getItem(key(observationId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftRecord;
      if (typeof parsed.text !== "string" || typeof parsed.revision !== "number") return null;
      return parsed;
    } catch {
      return null;
    }
  },
  write(observationId: string, record: DraftRecord) {
    try {
      window.localStorage.setItem(key(observationId), JSON.stringify({ ...record, updatedAt: new Date().toISOString() }));
    } catch {
      /* ignore */
    }
  },
  clear(observationId: string) {
    try {
      window.localStorage.removeItem(key(observationId));
    } catch {
      /* ignore */
    }
  },
};
