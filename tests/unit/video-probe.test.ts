import { describe, expect, it } from "vitest";
import { isHevc, probeVideoBytes } from "@/lib/video-probe";

const ascii = (s: string) => Array.from(s, (ch) => ch.charCodeAt(0));

function box(type: string, payload: number[]): number[] {
  const size = 8 + payload.length;
  return [(size >>> 24) & 255, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, ...ascii(type), ...payload];
}
/** hdlr: version/flags(4) + pre_defined(4) + handler_type(4) + name */
const hdlr = (handler: string) => box("hdlr", [0, 0, 0, 0, 0, 0, 0, 0, ...ascii(handler), 0]);

function mp4(handlers: string[], codecs: string[]): Uint8Array {
  const ftyp = box("ftyp", [...ascii("isom"), 0, 0, 2, 0, ...ascii("isomiso2")]);
  const tracks = handlers.flatMap((h) => hdlr(h));
  const stsd = codecs.flatMap((c) => box(c, new Array(16).fill(0)));
  const moov = box("moov", [...tracks, ...stsd]);
  return new Uint8Array([...ftyp, ...moov]);
}

describe("probeVideoBytes (mp4)", () => {
  it("soun 핸들러가 있으면 hasAudio=true", () => {
    const p = probeVideoBytes(mp4(["vide", "soun"], ["avc1", "mp4a"]));
    expect(p.container).toBe("mp4");
    expect(p.hasAudio).toBe(true);
    expect(p.videoCodecs).toEqual(["avc1"]);
    expect(isHevc(p)).toBe(false);
  });

  it("비디오 트랙만 있으면 hasAudio=false", () => {
    const p = probeVideoBytes(mp4(["vide"], ["avc1"]));
    expect(p.hasAudio).toBe(false);
  });

  it("HEVC 코덱을 식별한다", () => {
    const p = probeVideoBytes(mp4(["vide", "soun"], ["hvc1", "mp4a"]));
    expect(p.videoCodecs).toEqual(["hvc1"]);
    expect(isHevc(p)).toBe(true);
  });

  it("moov 가 파일 끝에 있어도(ftyp 뒤 mdat) 찾는다", () => {
    const base = mp4(["soun"], ["avc1"]);
    const mdat = box("mdat", new Array(64).fill(7));
    // ftyp + mdat + moov 순서로 재배치
    const ftypLen = 8 + 16;
    const rebuilt = new Uint8Array([...base.subarray(0, ftypLen), ...mdat, ...base.subarray(ftypLen)]);
    expect(probeVideoBytes(rebuilt).hasAudio).toBe(true);
  });
});

describe("probeVideoBytes (webm)", () => {
  const ebml = [0x1a, 0x45, 0xdf, 0xa3];
  it("A_OPUS 코덱 ID 가 있으면 hasAudio=true", () => {
    const p = probeVideoBytes(new Uint8Array([...ebml, 0, 0, ...ascii("V_VP9"), 0, ...ascii("A_OPUS"), 0]));
    expect(p.container).toBe("webm");
    expect(p.hasAudio).toBe(true);
    expect(p.videoCodecs).toEqual(["V_VP9"]);
  });
  it("오디오 코덱이 없으면 hasAudio=false", () => {
    const p = probeVideoBytes(new Uint8Array([...ebml, 0, 0, ...ascii("V_VP9"), 0]));
    expect(p.hasAudio).toBe(false);
  });
});

describe("probeVideoBytes (unknown)", () => {
  it("알 수 없는 컨테이너는 hasAudio=null", () => {
    const p = probeVideoBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(p.container).toBe("unknown");
    expect(p.hasAudio).toBeNull();
  });
  it("빈 입력도 안전하다", () => {
    expect(probeVideoBytes(new Uint8Array(0)).hasAudio).toBeNull();
  });
});
