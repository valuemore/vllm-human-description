import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export type ApiOk<T> = { ok: true; data: T; server_now: string };
export type ApiFail = { ok: false; code: string; message: string; details?: unknown; server_now: string };

const NO_STORE = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } as const;

export function ok<T>(data: T, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json<ApiOk<T>>(
    { ok: true, data, server_now: new Date().toISOString() },
    { status: init?.status ?? 200, headers: { ...NO_STORE, ...(init?.headers ?? {}) } },
  );
}

export function fail(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json<ApiFail>(
    { ok: false, code, message, details, server_now: new Date().toISOString() },
    { status, headers: NO_STORE },
  );
}

/** Route Handler 공통 래퍼: AppError / ZodError 를 규약 응답으로 변환 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AppError) return fail(err.code, err.message, err.status, err.details);
      if (err instanceof ZodError) return fail("VALIDATION", "입력값이 올바르지 않습니다", 400, err.issues);
      console.error("[api] unhandled", err);
      return fail("INTERNAL", "서버 오류가 발생했습니다", 500);
    }
  };
}

/** JSON 또는 sendBeacon(text/plain) 본문 파싱 */
export async function readJson(req: Request): Promise<unknown> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return req.json();
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION", "본문을 해석할 수 없습니다");
  }
}
