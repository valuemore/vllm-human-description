import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PARTICIPANT_COOKIE = "pst";
const PARTICIPANT_PATHS = ["/welcome", "/consent", "/profile", "/guide", "/practice", "/study", "/complete"];

/**
 * 경량 게이트. DB 조회 없이
 *  - 참여자 라우트: 세션 쿠키가 없으면 /enter 로
 *  - 관리자 라우트: Supabase Auth 세션 쿠키 갱신 (실제 인가는 requireAdmin 에서)
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PARTICIPANT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!request.cookies.get(PARTICIPANT_COOKIE)?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/enter";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    let response = NextResponse.next({ request });
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    return response;
  }

  return NextResponse.next();
}

export const proxyConfig = {
  matcher: ["/welcome", "/consent", "/profile", "/guide", "/practice", "/study/:path*", "/complete", "/admin/:path*"],
};
