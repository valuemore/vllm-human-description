// 서버 전용 모듈. 클라이언트 컴포넌트에서 import 하지 않는다 (scripts 에서도 사용하므로 server-only 마커는 db/service-client 에 둔다).
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PARTICIPANT_SESSION_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(16).optional(),
  VIDEO_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/** 서버 환경변수를 1회 검증하고 캐시한다. 누락 시 명확한 메시지로 실패한다. */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`환경변수 검증 실패:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
