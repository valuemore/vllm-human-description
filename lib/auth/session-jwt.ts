import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";

export const PARTICIPANT_COOKIE = "pst";
export const PARTICIPANT_SESSION_HOURS = 12;

export type ParticipantClaims = { sid: string; pid: string; stid: string };

function secret() {
  return new TextEncoder().encode(getEnv().PARTICIPANT_SESSION_SECRET);
}

export async function signParticipantToken(claims: ParticipantClaims, expiresAt: Date): Promise<string> {
  return new SignJWT({ pid: claims.pid, stid: claims.stid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sid)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
}

export async function verifyParticipantToken(token: string): Promise<ParticipantClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.pid !== "string" || typeof payload.stid !== "string") return null;
    return { sid: payload.sub, pid: payload.pid, stid: payload.stid };
  } catch {
    return null;
  }
}

export function participantCookieOptions(expiresAt: Date) {
  return {
    name: PARTICIPANT_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
