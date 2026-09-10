import { hash, verify } from "@node-rs/argon2";
import { randomInt } from "node:crypto";

const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/** 6자리 숫자 PIN (선행 0 허용) */
export function generatePin(length = 6): string {
  let pin = "";
  for (let i = 0; i < length; i++) pin += String(randomInt(0, 10));
  return pin;
}

export async function hashPin(pin: string): Promise<string> {
  return hash(pin, ARGON_OPTS);
}

export async function verifyPin(pinHash: string, pin: string): Promise<boolean> {
  try {
    return await verify(pinHash, pin);
  } catch {
    return false;
  }
}

export const PIN_REGEX = /^\d{4,6}$/;
export const PARTICIPANT_CODE_REGEX = /^[A-Z]\d{2,3}$/;
