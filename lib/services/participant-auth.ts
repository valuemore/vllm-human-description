import "server-only";
import { cookies, headers } from "next/headers";
import { getServiceClient } from "@/lib/db/service-client";
import { AppError } from "@/lib/errors";
import { verifyPin } from "@/lib/auth/pin";
import { PARTICIPANT_COOKIE, PARTICIPANT_SESSION_HOURS, participantCookieOptions, signParticipantToken } from "@/lib/auth/session-jwt";
import { isStudyOpen, type ParticipantContext } from "@/lib/auth/participant";
import { loadParticipantSnapshot } from "@/lib/participant/snapshot";
import { resolveNextStep, type ParticipantStep } from "@/lib/participant/resolveNextStep";
import type { EnterInput } from "@/lib/validation/participant";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

async function clientMeta() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  return { ip: ip && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null, userAgent: h.get("user-agent")?.slice(0, 500) ?? null };
}

/** 참여코드 + PIN 로그인. 실패 5회 → 15분 잠금. 성공 시 세션 발급 + 쿠키 설정. */
export async function loginParticipant(input: EnterInput): Promise<{ step: ParticipantStep; participantCode: string }> {
  const sb = getServiceClient();
  // 참여코드는 연구(study) 단위로 유일하다. 진행 중(active/pilot)인 연구의 참여자를 우선 선택한다.
  const { data: candidates, error: lookupError } = await sb
    .from("participants")
    .select("*, studies!inner(status)")
    .eq("participant_code", input.participant_code)
    .order("created_at", { ascending: false });
  if (lookupError) throw new AppError("INTERNAL", lookupError.message);
  const openStatuses = new Set(["active", "pilot"]);
  const participant =
    candidates?.find((c) => openStatuses.has((c.studies as { status: string }).status)) ?? candidates?.[0] ?? null;
  // 코드 존재 여부를 응답 시간으로 드러내지 않도록 항상 해시 검증을 수행한다.
  const dummyHash = "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  if (!participant) {
    await verifyPin(dummyHash, input.pin);
    throw new AppError("INVALID_CREDENTIALS", "참여코드 또는 PIN이 올바르지 않습니다");
  }
  if (participant.locked_until && new Date(participant.locked_until) > new Date()) {
    throw new AppError("LOCKED_OUT", "잠시 후 다시 시도해 주세요");
  }
  const valid = await verifyPin(participant.pin_hash, input.pin);
  if (!valid) {
    const attempts = participant.failed_pin_attempts + 1;
    await sb
      .from("participants")
      .update({
        failed_pin_attempts: attempts,
        locked_until: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
      })
      .eq("id", participant.id);
    if (attempts >= MAX_FAILED_ATTEMPTS) throw new AppError("LOCKED_OUT", "잠시 후 다시 시도해 주세요");
    throw new AppError("INVALID_CREDENTIALS", "참여코드 또는 PIN이 올바르지 않습니다");
  }

  const { data: study } = await sb.from("studies").select("*").eq("id", participant.study_id).single();
  if (!study || !isStudyOpen(study)) throw new AppError("STUDY_INACTIVE", "연구가 현재 진행 중이 아닙니다");
  if (participant.status === "withdrawn" || participant.status === "technical_issue") {
    throw new AppError("PARTICIPANT_BLOCKED", "참여가 종료된 코드입니다");
  }

  const meta = await clientMeta();
  const expiresAt = new Date(Date.now() + PARTICIPANT_SESSION_HOURS * 3600_000);
  const { data: session, error } = await sb
    .from("participant_sessions")
    .insert({ participant_id: participant.id, expires_at: expiresAt.toISOString(), ip: meta.ip, user_agent: meta.userAgent })
    .select("id")
    .single();
  if (error || !session) throw new AppError("INTERNAL", "세션을 만들 수 없습니다");

  await sb
    .from("participants")
    .update({
      failed_pin_attempts: 0,
      locked_until: null,
      last_seen_at: new Date().toISOString(),
      user_agent_first: participant.user_agent_first ?? meta.userAgent,
    })
    .eq("id", participant.id);

  const token = await signParticipantToken({ sid: session.id, pid: participant.id, stid: study.id }, expiresAt);
  const jar = await cookies();
  jar.set({ ...participantCookieOptions(expiresAt), value: token });

  const { studies: joined, ...participantRow } = participant;
  void joined;
  const ctx: ParticipantContext = { sessionId: session.id, participant: participantRow, study };
  const step = resolveNextStep(await loadParticipantSnapshot(ctx));
  return { step, participantCode: participant.participant_code };
}

export async function logoutParticipant(ctx: ParticipantContext | null) {
  if (ctx) {
    await getServiceClient().from("participant_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", ctx.sessionId);
  }
  const jar = await cookies();
  jar.delete(PARTICIPANT_COOKIE);
}

export type ParticipantState = {
  participant: { code: string; status: string };
  study: {
    maxObservationSeconds: number;
    timerMode: string;
    mobileAllowed: boolean;
    watermarkEnabled: boolean;
    consentVersion: string;
    replayEnabled: boolean;
  };
  step: ParticipantStep;
};

export async function getParticipantState(ctx: ParticipantContext): Promise<ParticipantState> {
  const step = resolveNextStep(await loadParticipantSnapshot(ctx));
  return {
    participant: { code: ctx.participant.participant_code, status: ctx.participant.status },
    study: {
      maxObservationSeconds: ctx.study.max_observation_seconds,
      timerMode: ctx.study.timer_mode,
      mobileAllowed: ctx.study.mobile_allowed,
      watermarkEnabled: ctx.study.watermark_enabled,
      consentVersion: ctx.study.consent_version,
      replayEnabled: ctx.study.replay_enabled,
    },
    step,
  };
}
