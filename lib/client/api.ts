"use client";

/** 참여자 화면용 API 클라이언트. 규약 {ok, data} | {ok:false, code, message} 를 처리한다. */
export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  readonly serverNow?: string;
  constructor(code: string, message: string, status: number, details?: unknown, serverNow?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.serverNow = serverNow;
  }
}

export type ApiResult<T> = { data: T; serverNow: string };

export async function apiRequest<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<ApiResult<T>> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      method: rest.method ?? (json !== undefined ? "POST" : "GET"),
      headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (e) {
    throw new ApiClientError("NETWORK", (e as Error).message, 0);
  }
  let body: { ok: boolean; data?: T; code?: string; message?: string; details?: unknown; server_now?: string };
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError("BAD_RESPONSE", `HTTP ${res.status}`, res.status);
  }
  if (!res.ok || !body.ok) {
    throw new ApiClientError(body.code ?? "INTERNAL", body.message ?? "오류", res.status, body.details, body.server_now);
  }
  return { data: body.data as T, serverNow: body.server_now ?? new Date().toISOString() };
}

export const apiGet = <T>(path: string) => apiRequest<T>(path);
export const apiPost = <T>(path: string, json: unknown) => apiRequest<T>(path, { method: "POST", json });
export const apiPut = <T>(path: string, json: unknown) => apiRequest<T>(path, { method: "PUT", json });
