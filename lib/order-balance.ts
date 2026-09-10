/**
 * 순서그룹 균형 (N개 순환 라틴방진). DB 함수 regenerate_order_groups / 뷰 v_order_balance_check 와 동일 규칙.
 * 모든 목표치는 (P, N) 에서 파생하며 코드 상수를 두지 않는다.
 */

export type StudyTargets = {
  participantTarget: number;
  videoCount: number;
  perGroupTarget: number;
  balancedPossible: boolean;
  totalObservationTarget: number;
};

export function computeTargets(participantTarget: number, videoCount: number): StudyTargets {
  if (!Number.isInteger(participantTarget) || participantTarget < 1) throw new Error("participantTarget must be >= 1");
  if (!Number.isInteger(videoCount) || videoCount < 2) throw new Error("videoCount must be >= 2");
  return {
    participantTarget,
    videoCount,
    perGroupTarget: Math.ceil(participantTarget / videoCount),
    balancedPossible: participantTarget % videoCount === 0,
    totalObservationTarget: participantTarget * videoCount,
  };
}

/**
 * 그룹 g(1-based)의 position p(1-based) 영상 인덱스(1-based) = ((g-1)+(p-1)) mod N + 1
 * 반환: orders[g-1][p-1] = videoIndex
 */
export function generateCyclicOrders(videoCount: number): number[][] {
  if (!Number.isInteger(videoCount) || videoCount < 2) throw new Error("videoCount must be >= 2");
  const orders: number[][] = [];
  for (let g = 1; g <= videoCount; g++) {
    const row: number[] = [];
    for (let p = 1; p <= videoCount; p++) row.push(((g - 1 + (p - 1)) % videoCount) + 1);
    orders.push(row);
  }
  return orders;
}

export type BalanceParticipant = { id: string; groupIndex: number; isValid: boolean };
export type BalanceAssignment = { participantId: string; videoIndex: number; position: number };

export type BalanceCheck = {
  checkName:
    | "participant_video_count"
    | "assignments_per_video"
    | "video_position_occurrence"
    | "group_valid_participants"
    | "balanced_possible";
  expected: number;
  actual: number;
  pass: boolean;
  detail: Record<string, number | boolean>;
};

/** PRD §27 / §47 Order Tests 를 (P, N) 파라미터로 일반화한 검증 */
export function validateBalance(input: {
  participantTarget: number;
  videoCount: number;
  participants: BalanceParticipant[];
  assignments: BalanceAssignment[];
}): BalanceCheck[] {
  const { participantTarget, videoCount, participants, assignments } = input;
  const targets = computeTargets(participantTarget, videoCount);
  const valid = participants.filter((p) => p.isValid);
  const validIds = new Set(valid.map((p) => p.id));
  const validAssignments = assignments.filter((a) => validIds.has(a.participantId));

  // 1. 참여자마다 N편 (서로 다른 영상)
  const perParticipant = new Map<string, Set<number>>();
  for (const a of validAssignments) {
    if (!perParticipant.has(a.participantId)) perParticipant.set(a.participantId, new Set());
    perParticipant.get(a.participantId)!.add(a.videoIndex);
  }
  const okParticipants = valid.filter((p) => (perParticipant.get(p.id)?.size ?? 0) === videoCount).length;

  // 2. 영상마다 유효 참여자 수만큼 배정
  const perVideo: Record<string, number> = {};
  for (let v = 1; v <= videoCount; v++) perVideo[`V${v}`] = 0;
  for (const a of validAssignments) perVideo[`V${a.videoIndex}`] = (perVideo[`V${a.videoIndex}`] ?? 0) + 1;
  const perVideoCounts = Object.values(perVideo);

  // 3. 영상 × position 각 셀 = 그룹당 목표
  const perCell: Record<string, number> = {};
  for (let v = 1; v <= videoCount; v++) for (let p = 1; p <= videoCount; p++) perCell[`V${v}@${p}`] = 0;
  for (const a of validAssignments) perCell[`V${a.videoIndex}@${a.position}`] = (perCell[`V${a.videoIndex}@${a.position}`] ?? 0) + 1;
  const cellCounts = Object.values(perCell);

  // 4. 그룹당 유효 참여자 = 목표
  const perGroup: Record<string, number> = {};
  for (let g = 1; g <= videoCount; g++) perGroup[`O${g}`] = 0;
  for (const p of valid) perGroup[`O${p.groupIndex}`] = (perGroup[`O${p.groupIndex}`] ?? 0) + 1;
  const groupCounts = Object.values(perGroup);

  return [
    {
      checkName: "participant_video_count",
      expected: valid.length,
      actual: okParticipants,
      pass: okParticipants === valid.length,
      detail: { videos_per_participant: videoCount },
    },
    {
      checkName: "assignments_per_video",
      expected: valid.length,
      actual: perVideoCounts.length ? Math.min(...perVideoCounts) : 0,
      pass: perVideoCounts.every((c) => c === valid.length),
      detail: perVideo,
    },
    {
      checkName: "video_position_occurrence",
      expected: targets.perGroupTarget,
      actual: cellCounts.length ? Math.min(...cellCounts) : 0,
      pass: cellCounts.every((c) => c === targets.perGroupTarget),
      detail: perCell,
    },
    {
      checkName: "group_valid_participants",
      expected: targets.perGroupTarget,
      actual: groupCounts.length ? Math.min(...groupCounts) : 0,
      pass: groupCounts.every((c) => c === targets.perGroupTarget),
      detail: perGroup,
    },
    {
      checkName: "balanced_possible",
      expected: 0,
      actual: targets.balancedPossible ? 0 : participantTarget % videoCount,
      pass: targets.balancedPossible,
      detail: { participant_target: participantTarget, video_count: videoCount, per_group_target: targets.perGroupTarget },
    },
  ];
}

/** 미달 그룹 중 group_index 최소값을 추천한다. 모두 충족이면 최소 인원 그룹. */
export function recommendGroupIndex(groups: { groupIndex: number; assignedValid: number; target: number }[]): number | null {
  if (groups.length === 0) return null;
  const sorted = [...groups].sort((a, b) => a.groupIndex - b.groupIndex);
  const under = sorted.find((g) => g.assignedValid < g.target);
  if (under) return under.groupIndex;
  return sorted.reduce((min, g) => (g.assignedValid < min.assignedValid ? g : min), sorted[0]).groupIndex;
}
