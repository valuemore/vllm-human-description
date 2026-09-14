"use client";

import { Maximize2, Minimize2, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { copy } from "@/lib/copy/participant.ko";
import { formatClock } from "@/lib/timer/timerMath";

type Props = {
  playing: boolean;
  currentMs: number;
  durationMs: number;
  muted: boolean;
  fullscreen: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSkip: (deltaMs: number) => void;
  onSeek: (ms: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
};

/** 자유 시청 컨트롤. 배속 UI 는 두지 않는다 (playback rate 1.0 고정). 소리 버튼은 has_audio 메타와 무관하게 항상 둔다 (메타 오감지로 소리 조절이 사라지지 않도록). */
export function PlayerControls(p: Props) {
  const c = copy.observation.controls;
  const btn = "inline-flex size-10 items-center justify-center rounded-md bg-white/90 text-neutral-800 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-b-xl bg-neutral-900/85 px-3 py-2 text-white" role="group" aria-label="영상 조작">
      <button type="button" className={btn} onClick={p.playing ? p.onPause : p.onPlay} aria-label={p.playing ? c.pause : c.play}>
        {p.playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <button type="button" className={btn} onClick={p.onRestart} aria-label={c.restart} title={c.restart}>
        <RotateCcw className="size-5" />
      </button>
      <button type="button" className={btn} onClick={() => p.onSkip(-5000)} aria-label={c.back5} title={c.back5}>
        <SkipBack className="size-5" />
      </button>
      <button type="button" className={btn} onClick={() => p.onSkip(5000)} aria-label={c.forward5} title={c.forward5}>
        <SkipForward className="size-5" />
      </button>
      <input
        type="range"
        className="mx-2 h-2 min-w-40 flex-1 cursor-pointer accent-sky-400"
        min={0}
        max={Math.max(p.durationMs, 1)}
        step={100}
        value={Math.min(p.currentMs, p.durationMs || p.currentMs)}
        onChange={(e) => p.onSeek(Number(e.target.value))}
        aria-label={c.slider}
        aria-valuetext={c.time(formatClock(p.currentMs / 1000), formatClock(p.durationMs / 1000))}
      />
      <span className="font-mono text-sm tabular-nums" aria-hidden="true">
        {c.time(formatClock(p.currentMs / 1000), formatClock(p.durationMs / 1000))}
      </span>
      <button type="button" className={btn} onClick={p.onToggleMute} aria-label={p.muted ? c.unmute : c.mute} aria-pressed={p.muted} title={p.muted ? c.unmute : c.mute}>
        {p.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
      <button type="button" className={btn} onClick={p.onToggleFullscreen} aria-label={p.fullscreen ? c.exitFullscreen : c.fullscreen}>
        {p.fullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
      </button>
    </div>
  );
}
