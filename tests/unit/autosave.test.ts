import { describe, expect, it } from "vitest";
import { backoffDelay, reconcileDraft } from "@/lib/autosave/draftReconcile";

describe("reconcileDraft", () => {
  const server = { text: "서버 초안", revision: 3, submitted: false };
  it("로컬이 더 최신 → 로컬 채택 + 서버로 push", () => {
    const r = reconcileDraft({ server, local: { text: "로컬 초안", revision: 5 } });
    expect(r).toMatchObject({ text: "로컬 초안", revision: 5, source: "local", pushToServer: true, discardLocal: false });
  });
  it("서버가 더 최신 → 서버 채택", () => {
    const r = reconcileDraft({ server, local: { text: "옛 로컬", revision: 2 } });
    expect(r).toMatchObject({ text: "서버 초안", revision: 3, source: "server", pushToServer: false });
  });
  it("동일 revision → 서버 채택", () => {
    expect(reconcileDraft({ server, local: { text: "x", revision: 3 } }).source).toBe("server");
  });
  it("로컬 없음 → 서버", () => {
    expect(reconcileDraft({ server, local: null }).source).toBe("server");
  });
  it("제출됨 → 로컬 폐기", () => {
    const r = reconcileDraft({ server: { ...server, submitted: true }, local: { text: "로컬", revision: 9 } });
    expect(r).toMatchObject({ source: "submitted", discardLocal: true, pushToServer: false, text: "서버 초안" });
  });
});

describe("backoffDelay", () => {
  it("1,2,4,8,15초 상한", () => {
    expect([0, 1, 2, 3, 4, 9].map(backoffDelay)).toEqual([1000, 2000, 4000, 8000, 15_000, 15_000]);
  });
});
