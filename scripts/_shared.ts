/** 스크립트 공통: .env.local 로드, service_role 클라이언트, 인자 파싱 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`환경변수 ${name} 이(가) 필요합니다. .env.local 을 확인하세요.`);
    process.exit(1);
  }
  return v;
}

export function serviceClient() {
  return createClient<Database>(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function option(name: string, fallback?: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("--")) return process.argv[idx + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return fallback;
}

export function fail(msg: string, err?: unknown): never {
  console.error(msg, err instanceof Error ? err.message : err ?? "");
  process.exitCode = 1;
  // process.exit() 는 열린 소켓 때문에 Windows 에서 libuv assertion 을 일으킬 수 있어 예외로 종료한다.
  throw new Error(`[seed] ${msg}`);
}

/** 관리자 계정 보장: auth.users 생성(또는 조회) + admin_users allowlist */
export async function ensureAdmin(sb: ReturnType<typeof serviceClient>, email: string, password: string, displayName = "연구 관리자") {
  const { data: list, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) fail("auth 사용자 조회 실패", listErr);
  let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) fail("관리자 auth 생성 실패", error);
    user = data.user;
  }
  const { error } = await sb.from("admin_users").upsert({ id: user.id, email, display_name: displayName, role: "admin", active: true });
  if (error) fail("admin_users upsert 실패", error);
  return user.id;
}
