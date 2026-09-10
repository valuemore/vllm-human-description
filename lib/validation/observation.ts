import { z } from "zod";

export const EVENT_TYPES = [
  "observation_started",
  "video_play",
  "video_pause",
  "video_seek",
  "video_ended",
  "video_buffer_start",
  "video_buffer_end",
  "video_error",
  "page_hidden",
  "page_visible",
  "network_offline",
  "network_online",
  "first_watch_blocked_action",
  "first_watch_restarted",
] as const;
/** 클라이언트가 보낼 수 있는 이벤트. video_first_play_started/completed, draft_saved, *_submitted 는 서버가 기록한다. */
export type ClientEventType = (typeof EVENT_TYPES)[number];

export const clientEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  seq: z.number().int().min(0),
  client_timestamp: z.string().datetime({ offset: true }),
  video_current_time_ms: z.number().int().min(0).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const eventBatchSchema = z.object({
  observation_id: z.string().uuid(),
  client_session_id: z.string().uuid(),
  client_now: z.string().datetime({ offset: true }),
  events: z.array(clientEventSchema).min(1).max(50),
});
export type EventBatchInput = z.infer<typeof eventBatchSchema>;

export const startSchema = z.object({
  client_elapsed_ms_since_play: z.number().int().min(0).max(60_000).default(0),
  client_session_id: z.string().uuid().optional(),
});

export const firstWatchCompleteSchema = z.object({
  max_watched_ms: z.number().int().min(0),
});

export const draftSchema = z.object({
  text: z.string().max(20_000),
  revision: z.number().int().min(1),
});

export const submitSchema = z.object({
  submission_type: z.enum(["manual", "timeout"]),
  revision: z.number().int().min(0).optional(),
  text: z.string().max(20_000).optional(),
});

export const signVideoSchema = z.object({
  observation_id: z.string().uuid(),
});
