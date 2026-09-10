"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { PlayerControls } from "@/components/participant/PlayerControls";
import { WatermarkOverlay } from "@/components/participant/WatermarkOverlay";
import { copy } from "@/lib/copy/participant.ko";
import type { PlayerAction, PlayerState } from "@/lib/player/playerMachine";

const BLOCKED_KEYS = new Set([" ", "k", "K", "ArrowLeft", "ArrowRight", "Home", "End", "j", "J", "l", "L", "MediaPlayPause", "MediaPause", "MediaPlay", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string | null;
  state: PlayerState;
  dispatch: (a: PlayerAction) => void;
  markUserSeek: (source: "slider" | "skip_button" | "keyboard" | "restart_button") => void;
  handlers: Record<string, () => void>;
  hasAudio: boolean;
  watermark: string | null;
  onRetry: () => void;
  urlError: string | null;
};

export function StudyVideoPlayer(p: Props) {
  const c = copy.observation;
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const { state, dispatch, videoRef } = p;
  const phase = state.phase;
  const free = phase === "free_watch";
  const firstWatching = phase === "first_watch_playing";

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
    if (firstWatching && BLOCKED_KEYS.has(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: "KEY_BLOCKED", key: e.key });
      return;
    }
    if (!free) return;
    const v = videoRef.current;
    if (!v) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      dispatch({ type: v.paused ? "USER_PLAY" : "USER_PAUSE" });
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      skip(e.key === "ArrowLeft" ? -5000 : 5000, "keyboard");
    }
  };

  const skip = useCallback(
    (deltaMs: number, source: "skip_button" | "keyboard") => {
      const v = videoRef.current;
      if (!v) return;
      p.markUserSeek(source);
      dispatch({ type: "USER_SEEK", toMs: Math.round(v.currentTime * 1000) + deltaMs, source });
    },
    [dispatch, p, videoRef],
  );

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const wrapped = {
    ...p.handlers,
    onPlaying: () => {
      setPlaying(true);
      p.handlers.onPlaying();
    },
    onPause: () => {
      setPlaying(false);
      p.handlers.onPause();
    },
    onTimeUpdate: () => {
      const v = videoRef.current;
      if (v) setCurrentMs(Math.round(v.currentTime * 1000));
      p.handlers.onTimeUpdate();
    },
    onEnded: () => {
      setPlaying(false);
      p.handlers.onEnded();
    },
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl bg-black outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      tabIndex={0}
      onKeyDownCapture={onKeyDown}
      aria-label="연구 영상"
    >
      <div className="relative aspect-video w-full">
        {p.src && (
          <video
            ref={videoRef}
            src={p.src}
            className="absolute inset-0 h-full w-full"
            preload="auto"
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            controlsList="nodownload noplaybackrate noremoteplayback"
            muted={muted}
            onContextMenu={(e) => e.preventDefault()}
            draggable={false}
            {...wrapped}
          />
        )}
        {p.watermark && <WatermarkOverlay text={p.watermark} />}

        {/* 첫 시청 중: 클릭/더블클릭 차단 실드 */}
        {firstWatching && <div className="absolute inset-0 cursor-not-allowed" aria-hidden="true" />}

        {phase === "preloading" && (
          <Overlay>
            <Loader2 className="size-8 animate-spin" aria-hidden="true" />
            <p>{p.urlError ? c.mediaError : c.preparing}</p>
            {p.urlError && (
              <Button variant="secondary" onClick={p.onRetry}>
                {c.retry}
              </Button>
            )}
          </Overlay>
        )}
        {phase === "ready" && (
          <Overlay>
            <p className="max-w-md text-center">{c.startHint}</p>
            <Button size="lg" className="h-12 px-8 text-base" onClick={() => dispatch({ type: "USER_START" })} autoFocus>
              {c.startWatch}
            </Button>
          </Overlay>
        )}
        {phase === "ready_restart" && (
          <Overlay>
            <p className="text-lg font-semibold">{c.restartTitle}</p>
            <p className="max-w-md text-center">{c.restartBody}</p>
            <Button size="lg" className="h-12 px-8 text-base" onClick={() => dispatch({ type: "USER_RESTART" })} autoFocus>
              {c.restart}
            </Button>
          </Overlay>
        )}
        {(firstWatching || phase === "first_watch_completed") && state.isBuffering && (
          <div className="absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-xs text-white" role="status">
            <Loader2 className="inline size-3 animate-spin" aria-hidden="true" /> 버퍼링
          </div>
        )}
        {phase === "error" && (
          <Overlay>
            <p role="alert">{c.mediaError}</p>
            <Button variant="secondary" onClick={p.onRetry}>
              {c.retry}
            </Button>
          </Overlay>
        )}
        {phase === "expired" && (
          <Overlay>
            <p className="text-lg font-semibold">{c.timeoutTitle}</p>
          </Overlay>
        )}
      </div>
      {firstWatching && (
        <p className="bg-neutral-900 px-3 py-2 text-center text-sm text-neutral-200" role="status">
          {c.firstWatching}
        </p>
      )}
      {free && (
        <PlayerControls
          playing={playing}
          currentMs={currentMs}
          durationMs={state.durationMs}
          muted={muted}
          hasAudio={p.hasAudio}
          fullscreen={fullscreen}
          onPlay={() => dispatch({ type: "USER_PLAY" })}
          onPause={() => dispatch({ type: "USER_PAUSE" })}
          onRestart={() => {
            p.markUserSeek("restart_button");
            dispatch({ type: "USER_SEEK", toMs: 0, source: "restart_button" });
            dispatch({ type: "USER_PLAY" });
          }}
          onSkip={(d) => skip(d, "skip_button")}
          onSeek={(ms) => {
            p.markUserSeek("slider");
            dispatch({ type: "USER_SEEK", toMs: ms, source: "slider" });
          }}
          onToggleMute={() => setMuted((m) => !m)}
          onToggleFullscreen={toggleFullscreen}
        />
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75 p-6 text-white">{children}</div>;
}
