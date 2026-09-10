/** UA/뷰포트 기반 기기·브라우저 분류 (순수함수). 연구 export 의 device_category / browser_category 에 쓰인다. */
export type DeviceCategory = "desktop" | "mobile" | "tablet" | "unknown";
export type BrowserCategory = "chrome" | "edge" | "safari" | "firefox" | "samsung" | "whale" | "other";

export function classifyDeviceFromUA(ua: string | null | undefined): DeviceCategory {
  if (!ua) return "unknown";
  const s = ua.toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook/.test(s) || (/android/.test(s) && !/mobile/.test(s))) return "tablet";
  // iPadOS 13+ 는 데스크톱 UA 를 쓰므로 Macintosh + touch 는 클라이언트 판정에 맡긴다
  if (/iphone|ipod|android.*mobile|windows phone|mobi/.test(s)) return "mobile";
  return "desktop";
}

export function classifyBrowser(ua: string | null | undefined): BrowserCategory {
  if (!ua) return "other";
  const s = ua.toLowerCase();
  if (s.includes("whale")) return "whale";
  if (s.includes("samsungbrowser")) return "samsung";
  if (s.includes("edg/") || s.includes("edge/")) return "edge";
  if (s.includes("firefox/")) return "firefox";
  if (s.includes("chrome/") || s.includes("crios/")) return "chrome";
  if (s.includes("safari/")) return "safari";
  return "other";
}

/** 서버 UA 판정 + 클라이언트 신호(coarse pointer, 뷰포트)를 합쳐 최종 기기 분류 */
export function resolveDevice(input: { ua: string | null; coarsePointer?: boolean; viewportWidth?: number }): DeviceCategory {
  const fromUA = classifyDeviceFromUA(input.ua);
  if (fromUA !== "desktop" && fromUA !== "unknown") return fromUA;
  if (input.coarsePointer && (input.viewportWidth ?? 9999) < 1024) return (input.viewportWidth ?? 0) < 700 ? "mobile" : "tablet";
  return fromUA;
}

export function isMobileLike(category: DeviceCategory): boolean {
  return category === "mobile" || category === "tablet";
}
