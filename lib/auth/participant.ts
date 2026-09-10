import "server-only";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError } from "@/lib/errors";
import { PARTICIPANT_COOKIE, verifyParticipantToken } from "@/lib/auth/session-jwt";
import type { Database } from "@/types/database";

export type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
export type StudyRow = Database["public"]["Tables"]["studies"]["Row"];

export type ParticipantContext = {
  sessionId: string;
  participant: ParticipantRow;
  study: StudyRow;
};

const LAST_SEEN_THROTTLE_MS = 60_000;

/** 쿠키 → JWT → 세션 행 → 참여자. 유효하지 않으면 null (redirect 는 호출자가 결정) */
export async function getParticipantContext(): Promise<ParticipantContext | null> {
  const jar = await cookies();
  const token = jar.get(PARTICIPANT_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyParticipantToken(token);
  if (!claims) return null;

  const sb = getServiceClient();
  const { data: session } = await sb
    .from("participant_sessions")
    .select("id, participant_id, expires_at, revoked_at, last_seen_at")
    .eq("id", claims.sid)
    .maybeSingle();
  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) return null;
  if (session.participant_id !== claims.pid) return null;

  const { data: participant } = await sb.from("participants").select("*").eq("id", claims.pid).maybeSingle();
  if (!participant) return null;
  const { data: study } = await sb.from("studies").select("*").eq("id", participant.study_id).maybeSingle();
  if (!study) return null;

  const now = Date.now();
  if (now - new Date(session.last_seen_at).getTime() > LAST_SEEN_THROTTLE_MS) {
    const iso = new Date(now).toISOString();
    await Promise.all([
      sb.from("participant_sessions").update({ last_seen_at: iso }).eq("id", session.id),
      sb.from("participants").update({ last_seen_at: iso }).eq("id", participant.id),
    ]);
  }
  return { sessionId: session.id, participant, study };
}

/** Route Handler 용: 세션이 없으면 401. 연구 비활성/참여 종료는 403. */
export async function requireParticipant(): Promise<ParticipantContext> {
  const ctx = await getParticipantContext();
  if (!ctx) throw new AppError("UNAUTHENTICATED", "다시 접속해 주세요");
  assertParticipantActive(ctx);
  return ctx;
}

export function isStudyOpen(study: Pick<StudyRow, "status">): boolean {
  return study.status === "active" || study.status === "pilot";
}

export function assertParticipantActive(ctx: ParticipantContext) {
  if (!isStudyOpen(ctx.study)) throw new AppError("STUDY_INACTIVE", "연구가 현재 진행 중이 아닙니다");
  if (ctx.participant.status === "withdrawn" || ctx.participant.status === "technical_issue") {
    throw new AppError("PARTICIPANT_BLOCKED", "참여가 종료된 코드입니다");
  }
}

/** 소유권 검증: 다른 참여자의 관찰은 존재 자체를 숨긴다 (404) */
export function assertOwnership(ctx: ParticipantContext, row: { participant_id: string } | null | undefined) {
  if (!row || row.participant_id !== ctx.participant.id) throw new AppError("NOT_FOUND", "찾을 수 없습니다");
}
