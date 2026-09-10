/**
 * 상호작용 이벤트 로거. seq 단조 증가, 배치 전송, critical 즉시 전송, 미전송 큐 보존/복원.
 * DOM/네트워크는 주입(transport, storage, clock) 하여 단위테스트 가능하게 한다.
 */
export type LoggedEvent = {
  type: string;
  seq: number;
  client_timestamp: string;
  video_current_time_ms: number | null;
  metadata: Record<string, unknown>;
};

export type EventBatch = {
  observation_id: string;
  client_session_id: string;
  client_now: string;
  events: LoggedEvent[];
};

export type EventTransport = {
  /** 일반 전송 (fetch). 실패 시 throw → 큐에 남긴다 */
  send: (batch: EventBatch) => Promise<{ status?: string }>;
  /** 페이지 이탈 시 전송 (sendBeacon). 수락 여부 반환 */
  beacon?: (batch: EventBatch) => boolean;
};

export type EventStorage = {
  read: () => LoggedEvent[] | null;
  write: (events: LoggedEvent[]) => void;
  clear: () => void;
};

export type EventLoggerOptions = {
  observationId: string;
  clientSessionId: string;
  transport: EventTransport;
  storage?: EventStorage;
  now?: () => Date;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
  batchMs?: number;
  batchSize?: number;
  immediateTypes?: ReadonlySet<string>;
  onFlushResult?: (result: { status?: string } | null, error: unknown) => void;
};

export const DEFAULT_IMMEDIATE_TYPES: ReadonlySet<string> = new Set(["observation_started", "first_watch_restarted", "video_error"]);

export class EventLogger {
  private seq = 0;
  private queue: LoggedEvent[] = [];
  private inflight: LoggedEvent[] | null = null;
  private timer: unknown = null;
  private stopped = false;
  private readonly o: Required<Pick<EventLoggerOptions, "batchMs" | "batchSize" | "immediateTypes" | "now" | "setTimer" | "clearTimer">> & EventLoggerOptions;

  constructor(options: EventLoggerOptions) {
    this.o = {
      batchMs: 2000,
      batchSize: 20,
      immediateTypes: DEFAULT_IMMEDIATE_TYPES,
      now: () => new Date(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      ...options,
    };
    // 이전 세션에서 전송 못 한 이벤트 복원 (seq 는 새 세션 기준으로 재부여하지 않고 metadata 에 표시)
    const restored = this.o.storage?.read();
    if (restored?.length) {
      for (const e of restored) this.queue.push({ ...e, seq: this.seq++, metadata: { ...e.metadata, restored: true, original_seq: e.seq } });
      this.persist();
      this.schedule(0);
    }
  }

  get pendingCount() {
    return this.queue.length + (this.inflight?.length ?? 0);
  }

  log(type: string, metadata: Record<string, unknown> = {}, videoCurrentTimeMs: number | null = null) {
    if (this.stopped) return;
    const event: LoggedEvent = {
      type,
      seq: this.seq++,
      client_timestamp: this.o.now().toISOString(),
      video_current_time_ms: videoCurrentTimeMs === null ? null : Math.max(0, Math.round(videoCurrentTimeMs)),
      metadata,
    };
    this.queue.push(event);
    this.persist();
    if (this.o.immediateTypes.has(type) || this.queue.length >= this.o.batchSize) void this.flush();
    else this.schedule(this.o.batchMs);
  }

  private schedule(ms: number) {
    if (this.timer !== null) return;
    this.timer = this.o.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  private persist() {
    this.o.storage?.write([...(this.inflight ?? []), ...this.queue]);
  }

  private batch(events: LoggedEvent[]): EventBatch {
    return { observation_id: this.o.observationId, client_session_id: this.o.clientSessionId, client_now: this.o.now().toISOString(), events };
  }

  async flush(): Promise<void> {
    if (this.inflight || this.queue.length === 0) return;
    if (this.timer !== null) {
      this.o.clearTimer(this.timer);
      this.timer = null;
    }
    const events = this.queue.splice(0, 50);
    this.inflight = events;
    try {
      const result = await this.o.transport.send(this.batch(events));
      this.inflight = null;
      this.persist();
      this.o.onFlushResult?.(result, null);
    } catch (err) {
      // 실패: 큐 앞에 되돌리고 재시도 예약
      this.queue.unshift(...events);
      this.inflight = null;
      this.persist();
      this.o.onFlushResult?.(null, err);
      this.schedule(Math.min(this.o.batchMs * 4, 10_000));
      return;
    }
    if (this.queue.length) this.schedule(this.o.batchMs);
  }

  /** 페이지 이탈: 남은 이벤트를 beacon 으로 보낸다. 실패하면 storage 에 남겨 다음 로드에서 복원 */
  flushOnUnload(): boolean {
    const events = [...(this.inflight ?? []), ...this.queue];
    if (events.length === 0) return true;
    const ok = this.o.transport.beacon?.(this.batch(events)) ?? false;
    if (ok) {
      this.queue = [];
      this.inflight = null;
      this.o.storage?.clear();
    } else {
      this.persist();
    }
    return ok;
  }

  stop() {
    this.stopped = true;
    if (this.timer !== null) {
      this.o.clearTimer(this.timer);
      this.timer = null;
    }
  }

  /** React StrictMode 의 effect 재실행 등으로 stop 된 로거를 되살린다 */
  resume() {
    this.stopped = false;
    if (this.queue.length) this.schedule(this.o.batchMs);
  }
}

export function createLocalEventStorage(observationId: string): EventStorage {
  const key = `obs-events:${observationId}`;
  return {
    read() {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as LoggedEvent[]) : null;
      } catch {
        return null;
      }
    },
    write(events) {
      try {
        if (events.length === 0) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(events.slice(-200)));
      } catch {
        /* ignore */
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}
