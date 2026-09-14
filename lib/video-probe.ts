/**
 * 브라우저·스크립트 공용 영상 컨테이너 프로브 (외부 라이브러리 없음).
 * <video> 요소의 오디오 감지 API 는 브라우저마다 다르고 Chromium 은 metadata 단계에서
 * webkitAudioDecodedByteCount 가 항상 0 이라 has_audio 가 false 로 저장되는 문제가 있었다.
 * 컨테이너 바이트를 직접 훑어 오디오 트랙·코덱을 판정한다.
 *
 * - MP4/MOV: `hdlr` 박스의 handler_type 이 `soun` 이면 오디오 트랙 존재.
 * - WebM/Matroska: 오디오 코덱 ID 문자열(`A_OPUS`, `A_VORBIS`, `A_AAC` …)이 있으면 오디오 트랙 존재.
 * - 알 수 없는 컨테이너면 hasAudio = null (호출자가 다른 방법으로 판정).
 */

export type VideoProbe = {
  container: "mp4" | "webm" | "unknown";
  /** null = 컨테이너를 해석하지 못해 판정 불가 */
  hasAudio: boolean | null;
  /** 발견된 비디오 코덱 태그 (avc1, hvc1, hev1, av01, vp09, V_VP9 …) */
  videoCodecs: string[];
};

const ASCII = (s: string) => Array.from(s, (ch) => ch.charCodeAt(0));

const MP4_VIDEO_CODECS = ["avc1", "avc3", "hvc1", "hev1", "av01", "vp09", "mp4v"];
const WEBM_VIDEO_CODECS = ["V_VP8", "V_VP9", "V_AV1", "V_MPEG4/ISO/AVC", "V_MPEGH/ISO/HEVC"];
const WEBM_AUDIO_CODECS = ["A_OPUS", "A_VORBIS", "A_AAC", "A_MPEG/L3", "A_FLAC", "A_PCM"];
/** HEVC 는 Windows Chrome/Firefox 에서 하드웨어 디코더가 없으면 재생되지 않는다 */
const HEVC_TAGS = new Set(["hvc1", "hev1", "V_MPEGH/ISO/HEVC"]);

function indexOfBytes(hay: Uint8Array, needle: number[], from = 0): number {
  const first = needle[0];
  const last = hay.length - needle.length;
  outer: for (let i = from; i <= last; i++) {
    if (hay[i] !== first) continue;
    for (let j = 1; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

function contains(hay: Uint8Array, s: string) {
  return indexOfBytes(hay, ASCII(s)) >= 0;
}

function detectContainer(bytes: Uint8Array): VideoProbe["container"] {
  // EBML 헤더 (WebM/MKV)
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  // ISO BMFF: 첫 박스 type 이 ftyp (offset 4)
  if (bytes.length >= 8 && indexOfBytes(bytes.subarray(4, 8), ASCII("ftyp")) === 0) return "mp4";
  // ftyp 가 앞에 없어도 moov 가 있으면 mp4 로 간주
  if (contains(bytes, "moov") && contains(bytes, "hdlr")) return "mp4";
  return "unknown";
}

/** `hdlr` 박스: [size 4][type 'hdlr' 4][version/flags 4][pre_defined 4][handler_type 4] */
function mp4HandlerTypes(bytes: Uint8Array): string[] {
  const out: string[] = [];
  const tag = ASCII("hdlr");
  let i = indexOfBytes(bytes, tag);
  while (i >= 0) {
    const h = i + 12;
    if (h + 4 <= bytes.length) out.push(String.fromCharCode(bytes[h], bytes[h + 1], bytes[h + 2], bytes[h + 3]));
    i = indexOfBytes(bytes, tag, i + 4);
  }
  return out;
}

export function probeVideoBytes(bytes: Uint8Array): VideoProbe {
  const container = detectContainer(bytes);
  if (container === "mp4") {
    const handlers = mp4HandlerTypes(bytes);
    return {
      container,
      hasAudio: handlers.includes("soun"),
      videoCodecs: MP4_VIDEO_CODECS.filter((c) => contains(bytes, c)),
    };
  }
  if (container === "webm") {
    return {
      container,
      hasAudio: WEBM_AUDIO_CODECS.some((c) => contains(bytes, c)),
      videoCodecs: WEBM_VIDEO_CODECS.filter((c) => contains(bytes, c)),
    };
  }
  return { container, hasAudio: null, videoCodecs: [] };
}

export function isHevc(probe: Pick<VideoProbe, "videoCodecs">) {
  return probe.videoCodecs.some((c) => HEVC_TAGS.has(c));
}
