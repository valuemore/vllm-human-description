import { describe, expect, it } from "vitest";
import { formatClock, medianOffset, remainingAt, timerLevel } from "@/lib/timer/timerMath";

describe("remainingAt", () => {
  it("앵커로부터 경과한 만큼 감쇠", () => {
    const anchor = { remainingSeconds: 200, receivedAtPerf: 10_000 };
    expect(remainingAt(anchor, 15_000)).toBe(195);
  });
  it("effective 모드: 앵커 이후 로컬 버퍼링을 더한다, wall 모드는 무시", () => {
    const anchor = { remainingSeconds: 200, receivedAtPerf: 0 };
    expect(remainingAt(anchor, 30_000, 4, true)).toBe(174);
    expect(remainingAt(anchor, 30_000, 4, false)).toBe(170);
  });
  it("앵커 없음 → fallback", () => {
    expect(remainingAt(null, 100, 0, true, 300)).toBe(300);
  });
  it("재앵커는 서버 값을 채택하며 새로고침으로 초기화되지 않는다", () => {
    // 새로고침 후 서버가 준 remaining 이 초기값보다 작다
    const before = { remainingSeconds: 300, receivedAtPerf: 0 };
    const after = { remainingSeconds: 120, receivedAtPerf: 0 };
    expect(remainingAt(after, 1000)).toBeLessThan(remainingAt(before, 1000));
  });
});

describe("timerLevel / formatClock", () => {
  it("임계값", () => {
    expect(timerLevel(120)).toBe("normal");
    expect(timerLevel(60)).toBe("warn60");
    expect(timerLevel(30)).toBe("warn30");
    expect(timerLevel(10)).toBe("warn10");
    expect(timerLevel(0)).toBe("expired");
    expect(timerLevel(-5)).toBe("expired");
    expect(timerLevel(null)).toBe("normal"); // 제한 없음
  });
  it("mm:ss (올림, 음수 클램프)", () => {
    expect(formatClock(222)).toBe("03:42");
    expect(formatClock(59.2)).toBe("01:00");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-3)).toBe("00:00");
  });
});

describe("medianOffset", () => {
  it("중앙값", () => {
    expect(medianOffset([])).toBe(0);
    expect(medianOffset([5])).toBe(5);
    expect(medianOffset([1, 100, 3])).toBe(3);
    expect(medianOffset([1, 2, 3, 4])).toBe(2.5);
  });
});
