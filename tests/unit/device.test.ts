import { describe, expect, it } from "vitest";
import { classifyBrowser, classifyDeviceFromUA, isMobileLike, resolveDevice } from "@/lib/participant/device";

const UA = {
  chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  edgeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  androidPhone: "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
  androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  whale: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Whale/3.27.254.15 Safari/537.36",
};

describe("classifyDeviceFromUA", () => {
  it("데스크톱", () => {
    expect(classifyDeviceFromUA(UA.chromeWin)).toBe("desktop");
    expect(classifyDeviceFromUA(UA.safariMac)).toBe("desktop");
  });
  it("모바일/태블릿", () => {
    expect(classifyDeviceFromUA(UA.iphone)).toBe("mobile");
    expect(classifyDeviceFromUA(UA.androidPhone)).toBe("mobile");
    expect(classifyDeviceFromUA(UA.androidTablet)).toBe("tablet");
    expect(classifyDeviceFromUA(UA.ipad)).toBe("tablet");
    expect(classifyDeviceFromUA(null)).toBe("unknown");
  });
});

describe("classifyBrowser", () => {
  it("브라우저 분류", () => {
    expect(classifyBrowser(UA.chromeWin)).toBe("chrome");
    expect(classifyBrowser(UA.edgeWin)).toBe("edge");
    expect(classifyBrowser(UA.safariMac)).toBe("safari");
    expect(classifyBrowser(UA.whale)).toBe("whale");
    expect(classifyBrowser(UA.iphone)).toBe("safari");
  });
});

describe("resolveDevice", () => {
  it("iPadOS 데스크톱 UA + coarse pointer + 좁은 뷰포트 → tablet", () => {
    expect(resolveDevice({ ua: UA.safariMac, coarsePointer: true, viewportWidth: 820 })).toBe("tablet");
    expect(resolveDevice({ ua: UA.safariMac, coarsePointer: true, viewportWidth: 390 })).toBe("mobile");
  });
  it("터치 노트북(coarse + 넓은 뷰포트)은 desktop 유지", () => {
    expect(resolveDevice({ ua: UA.chromeWin, coarsePointer: true, viewportWidth: 1366 })).toBe("desktop");
  });
  it("isMobileLike", () => {
    expect(isMobileLike("mobile")).toBe(true);
    expect(isMobileLike("tablet")).toBe(true);
    expect(isMobileLike("desktop")).toBe(false);
  });
});
