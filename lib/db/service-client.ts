import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getEnv } from "@/lib/env";

export type ServiceClient = SupabaseClient<Database>;

let cached: ServiceClient | null = null;

/**
 * service_role 클라이언트. RLS 를 우회하므로 반드시 requireAdmin()/requireParticipant() 이후에만 사용한다.
 * 절대 클라이언트 번들로 내보내지 않는다.
 */
export function getServiceClient(): ServiceClient {
  if (cached) return cached;
  const env = getEnv();
  cached = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
