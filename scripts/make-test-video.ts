/**
 * 테스트/개발용 영상 fixture 생성 (ffmpeg-static).
 *   tests/fixtures/test-video-6s.mp4   : E2E 용 6초
 *   tests/fixtures/practice.mp4        : 20초
 *   tests/fixtures/research-1..N.mp4   : 35초 (N = --videos, 기본 5), 영상마다 다른 패턴/주파수
 * 실제 연구 영상이 아니라 합성 패턴 영상이다.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { option } from "./_shared";

const OUT = join(process.cwd(), "tests", "fixtures");
mkdirSync(OUT, { recursive: true });
if (!ffmpegPath) throw new Error("ffmpeg-static 바이너리를 찾을 수 없습니다");

const N = Number(option("videos", "5"));
const sources = ["testsrc2", "testsrc", "smptebars", "rgbtestsrc", "yuvtestsrc", "smptehdbars", "pal75bars", "pal100bars", "colorspectrum", "allrgb"];

function make(file: string, seconds: number, source: string, freq: number) {
  const out = join(OUT, file);
  if (existsSync(out)) {
    console.log(`존재: ${file}`);
    return;
  }
  execFileSync(
    ffmpegPath as string,
    [
      "-y", "-loglevel", "error",
      "-f", "lavfi", "-i", `${source}=size=640x360:rate=25`,
      "-f", "lavfi", "-i", `sine=frequency=${freq}:sample_rate=44100`,
      "-t", String(seconds),
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      "-c:a", "aac", "-b:a", "64k", "-shortest",
      out,
    ],
    { stdio: "inherit" },
  );
  console.log(`생성: ${file} (${seconds}s)`);
}

make("test-video-6s.mp4", 6, "testsrc2", 440);
make("practice.mp4", 20, "smptebars", 330);
for (let i = 1; i <= N; i++) make(`research-${i}.mp4`, 35, sources[i % sources.length], 220 + i * 55);
