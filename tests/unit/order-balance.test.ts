import { describe, expect, it } from "vitest";
import {
  computeTargets,
  generateCyclicOrders,
  recommendGroupIndex,
  validateBalance,
  type BalanceAssignment,
  type BalanceParticipant,
} from "@/lib/order-balance";

/** P명을 N개 그룹에 라운드로빈 배정하고 라틴방진에 따라 배정표를 만든다 */
function buildStudy(P: number, N: number, opts: { invalid?: number[] } = {}) {
  const orders = generateCyclicOrders(N);
  const participants: BalanceParticipant[] = [];
  const assignments: BalanceAssignment[] = [];
  for (let i = 0; i < P; i++) {
    const groupIndex = (i % N) + 1;
    const id = `T${String(i + 1).padStart(2, "0")}`;
    participants.push({ id, groupIndex, isValid: !(opts.invalid ?? []).includes(i + 1) });
    orders[groupIndex - 1].forEach((videoIndex, pIdx) => assignments.push({ participantId: id, videoIndex, position: pIdx + 1 }));
  }
  return { participants, assignments };
}

describe("computeTargets", () => {
  it("PRD 기본 설계 20×5 → 그룹당 4, 총 100", () => {
    expect(computeTargets(20, 5)).toEqual({
      participantTarget: 20,
      videoCount: 5,
      perGroupTarget: 4,
      balancedPossible: true,
      totalObservationTarget: 100,
    });
  });
  it("나누어떨어지지 않으면 균형 불가 경고", () => {
    const t = computeTargets(23, 5);
    expect(t.perGroupTarget).toBe(5);
    expect(t.balancedPossible).toBe(false);
  });
  it("잘못된 입력 거부", () => {
    expect(() => computeTargets(0, 5)).toThrow();
    expect(() => computeTargets(20, 1)).toThrow();
  });
});

describe("generateCyclicOrders", () => {
  it("N=5 는 PRD §4 의 O1~O5 와 일치", () => {
    expect(generateCyclicOrders(5)).toEqual([
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5, 1],
      [3, 4, 5, 1, 2],
      [4, 5, 1, 2, 3],
      [5, 1, 2, 3, 4],
    ]);
  });
  it.each([3, 5, 6, 7, 10])("N=%i: 각 그룹에 모든 영상이 정확히 한 번, 각 영상이 각 position 에 정확히 한 번", (n) => {
    const orders = generateCyclicOrders(n);
    expect(orders).toHaveLength(n);
    for (const row of orders) expect(new Set(row).size).toBe(n);
    for (let p = 0; p < n; p++) {
      const column = orders.map((row) => row[p]);
      expect(new Set(column).size).toBe(n);
    }
  });
});

describe("validateBalance", () => {
  it("20×5 완전 배정 → 4항목 PASS + 균형 가능", () => {
    const { participants, assignments } = buildStudy(20, 5);
    const checks = validateBalance({ participantTarget: 20, videoCount: 5, participants, assignments });
    expect(checks.every((c) => c.pass)).toBe(true);
    const cell = checks.find((c) => c.checkName === "video_position_occurrence")!;
    expect(cell.expected).toBe(4);
    expect(Object.values(cell.detail).every((v) => v === 4)).toBe(true);
    const group = checks.find((c) => c.checkName === "group_valid_participants")!;
    expect(group.detail).toEqual({ O1: 4, O2: 4, O3: 4, O4: 4, O5: 4 });
  });

  it("N=6, P=24 → 그룹당 4, PASS", () => {
    const { participants, assignments } = buildStudy(24, 6);
    const checks = validateBalance({ participantTarget: 24, videoCount: 6, participants, assignments });
    expect(checks.every((c) => c.pass)).toBe(true);
    expect(checks.find((c) => c.checkName === "assignments_per_video")!.actual).toBe(24);
  });

  it("N=7, P=21 → 그룹당 3, PASS", () => {
    const { participants, assignments } = buildStudy(21, 7);
    const checks = validateBalance({ participantTarget: 21, videoCount: 7, participants, assignments });
    expect(checks.every((c) => c.pass)).toBe(true);
  });

  it("P=23, N=5 → 균형 불가 경고, 그룹 검증 FAIL", () => {
    const { participants, assignments } = buildStudy(23, 5);
    const checks = validateBalance({ participantTarget: 23, videoCount: 5, participants, assignments });
    expect(checks.find((c) => c.checkName === "balanced_possible")!.pass).toBe(false);
    expect(checks.find((c) => c.checkName === "group_valid_participants")!.pass).toBe(false);
    // 참여자별 5편, 영상별 23건은 여전히 PASS
    expect(checks.find((c) => c.checkName === "participant_video_count")!.pass).toBe(true);
    expect(checks.find((c) => c.checkName === "assignments_per_video")!.pass).toBe(true);
  });

  it("중도탈락(is_valid=false)은 집계에서 제외되어 그룹 검증 FAIL, 대체 참여자 추가 시 PASS", () => {
    const base = buildStudy(20, 5, { invalid: [7] }); // T07(O2) 탈락
    const checks = validateBalance({ participantTarget: 20, videoCount: 5, ...base });
    expect(checks.find((c) => c.checkName === "group_valid_participants")!.pass).toBe(false);
    expect(checks.find((c) => c.checkName === "group_valid_participants")!.detail).toMatchObject({ O2: 3 });

    // 대체 참여자 T21 을 O2 에 추가
    const orders = generateCyclicOrders(5);
    base.participants.push({ id: "T21", groupIndex: 2, isValid: true });
    orders[1].forEach((videoIndex, pIdx) => base.assignments.push({ participantId: "T21", videoIndex, position: pIdx + 1 }));
    const after = validateBalance({ participantTarget: 20, videoCount: 5, ...base });
    expect(after.every((c) => c.pass)).toBe(true);
  });

  it("배정 누락은 participant_video_count FAIL", () => {
    const { participants, assignments } = buildStudy(20, 5);
    assignments.pop();
    const checks = validateBalance({ participantTarget: 20, videoCount: 5, participants, assignments });
    expect(checks.find((c) => c.checkName === "participant_video_count")!.pass).toBe(false);
    expect(checks.find((c) => c.checkName === "participant_video_count")!.actual).toBe(19);
  });
});

describe("recommendGroupIndex", () => {
  it("미달 그룹 중 최소 index", () => {
    expect(
      recommendGroupIndex([
        { groupIndex: 1, assignedValid: 4, target: 4 },
        { groupIndex: 2, assignedValid: 3, target: 4 },
        { groupIndex: 3, assignedValid: 2, target: 4 },
      ]),
    ).toBe(2);
  });
  it("모두 충족이면 최소 인원 그룹", () => {
    expect(
      recommendGroupIndex([
        { groupIndex: 1, assignedValid: 5, target: 4 },
        { groupIndex: 2, assignedValid: 4, target: 4 },
      ]),
    ).toBe(2);
  });
  it("빈 목록은 null", () => {
    expect(recommendGroupIndex([])).toBeNull();
  });
});
