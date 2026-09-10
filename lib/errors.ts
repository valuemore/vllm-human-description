/** API 에러 코드. 참여자 화면 문구는 lib/copy 에서 코드 → 문장으로 매핑한다. */
export const ErrorCodes = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  INVALID_CREDENTIALS: 401,
  LOCKED_OUT: 429,
  STUDY_INACTIVE: 403,
  PARTICIPANT_BLOCKED: 403,
  MOBILE_NOT_ALLOWED: 403,
  STEP_NOT_ALLOWED: 409,
  ALREADY_SUBMITTED: 409,
  TIMED_OUT: 409,
  NOT_STARTED: 409,
  FIRST_WATCH_REQUIRED: 422,
  FIRST_WATCH_REJECTED: 422,
  TOO_EARLY_FOR_TIMEOUT: 400,
  STALE_REVISION: 409,
  OBSERVATION_CLOSED: 409,
  ORDER_VIOLATION: 409,
  STRUCTURE_LOCKED: 409,
  CONFLICT: 409,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.code = code;
    this.status = ErrorCodes[code];
    this.details = details;
  }
}

/** Postgres 예외 메시지(예: 'STRUCTURE_LOCKED: ...')를 AppError 로 변환 */
export function fromDbError(err: { message?: string; code?: string } | null | undefined): AppError {
  const msg = err?.message ?? "";
  const m = msg.match(/^([A-Z_]+)(?::|$)/);
  const token = m?.[1];
  const map: Record<string, ErrorCode> = {
    ALREADY_SUBMITTED: "ALREADY_SUBMITTED",
    OBSERVATION_INVALIDATED: "OBSERVATION_CLOSED",
    OBSERVATION_CLOSED: "OBSERVATION_CLOSED",
    NOT_STARTED: "NOT_STARTED",
    FIRST_WATCH_REQUIRED: "FIRST_WATCH_REQUIRED",
    STRUCTURE_LOCKED: "STRUCTURE_LOCKED",
    PARTICIPANT_STARTED: "STRUCTURE_LOCKED",
    OBSERVATION_NOT_FOUND: "NOT_FOUND",
    PARTICIPANT_NOT_FOUND: "NOT_FOUND",
    STUDY_NOT_FOUND: "NOT_FOUND",
    ORDER_GROUP_NOT_FOUND: "NOT_FOUND",
    SUBMITTED_IMMUTABLE: "ALREADY_SUBMITTED",
    INVALIDATED_IMMUTABLE: "OBSERVATION_CLOSED",
  };
  if (token && map[token]) return new AppError(map[token], msg);
  if (err?.code === "23505") return new AppError("CONFLICT", msg);
  return new AppError("INTERNAL", msg || "database error");
}
