import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getEnv } from "@/lib/env";

/** 관리자(Supabase Auth) 세션이 적용된 서버 클라이언트. RLS(is_admin) 하에서 동작한다. */
export async function getAdminSessionClient() {
  const env = getEnv();
  const jar = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // Server Component 렌더 중에는 쿠키를 쓸 수 없다. proxy.ts 가 세션 갱신을 담당한다.
        }
      },
    },
  });
}
