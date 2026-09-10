import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventLogger, type EventBatch, type EventStorage, type LoggedEvent } from "@/lib/events/eventLogger";

function memStorage(initial: LoggedEvent[] | null = null): EventStorage & { data: LoggedEvent[] | null } {
  const s = {
    data: initial,
    read: () => s.data,
    write: (e: LoggedEvent[]) => {
      s.data = e.length ? e : null;
    },
    clear: () => {
      s.data = null;
    },
  };
  return s;
}

describe("EventLogger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function make(opts: { sendImpl?: (b: EventBatch) => Promise<{ status?: string }>; storage?: EventStorage; beacon?: (b: EventBatch) => boolean } = {}) {
    const sent: EventBatch[] = [];
    const send = vi.fn(async (b: EventBatch) => {
      if (opts.sendImpl) return opts.sendImpl(b);
      sent.push(b);
      return {};
    });
    const logger = new EventLogger({
      observationId: "obs",
      clientSessionId: "sess",
      transport: { send, beacon: opts.beacon },
      storage: opts.storage,
      now: () => new Date(Date.now()),
      batchMs: 2000,
      batchSize: 20,
    });
    return { logger, sent, send };
  }

  it("seq 는 0부터 단조 증가, 2초 후 배치 전송", async () => {
    const { logger, sent } = make();
    logger.log("video_play", { is_replay: false }, 1234.6);
    logger.log("video_pause", {}, 2000);
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sent).toHaveLength(1);
    expect(sent[0].events.map((e) => e.seq)).toEqual([0, 1]);
    expect(sent[0].events[0].video_current_time_ms).toBe(1235);
    expect(sent[0].client_session_id).toBe("sess");
  });

  it("critical 타입은 즉시 전송", async () => {
    const { logger, sent } = make();
    logger.log("observation_started", { device_category: "desktop" });
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1);
  });

  it("배치 크기 도달 시 즉시 전송", async () => {
    const { logger, sent } = make();
    for (let i = 0; i < 20; i++) logger.log("video_seek", {}, i);
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toHaveLength(20);
  });

  it("전송 실패 시 큐에 남기고 순서 유지하며 재시도", async () => {
    let fail = true;
    const sent: EventBatch[] = [];
    const { logger } = make({
      sendImpl: async (b) => {
        if (fail) throw new Error("network");
        sent.push(b);
        return {};
      },
    });
    logger.log("video_play", {}, 0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sent).toHaveLength(0);
    expect(logger.pendingCount).toBe(1);
    logger.log("video_pause", {}, 100);
    fail = false;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent).toHaveLength(1);
    expect(sent[0].events.map((e) => e.type)).toEqual(["video_play", "video_pause"]);
    expect(logger.pendingCount).toBe(0);
  });

  it("미전송 이벤트는 storage 에 보존되고 다음 로거가 복원해 재전송", async () => {
    const storage = memStorage();
    const { logger } = make({ sendImpl: async () => { throw new Error("offline"); }, storage });
    logger.log("page_hidden", {}, 5000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(storage.data).toHaveLength(1);
    logger.stop();

    const { logger: next, sent } = make({ storage });
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].events[0].type).toBe("page_hidden");
    expect(sent[0].events[0].metadata).toMatchObject({ restored: true, original_seq: 0 });
    expect(storage.data).toBeNull();
    void next;
  });

  it("flushOnUnload 는 beacon 으로 남은 이벤트를 보내고 큐를 비운다", () => {
    const beacon = vi.fn(() => true);
    const storage = memStorage();
    const { logger } = make({ beacon, storage });
    logger.log("video_play", {}, 0);
    expect(logger.flushOnUnload()).toBe(true);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(logger.pendingCount).toBe(0);
    expect(storage.data).toBeNull();
  });

  it("beacon 실패 시 storage 에 남긴다", () => {
    const storage = memStorage();
    const { logger } = make({ beacon: () => false, storage });
    logger.log("video_play", {}, 0);
    expect(logger.flushOnUnload()).toBe(false);
    expect(storage.data).toHaveLength(1);
  });
});

describe("EventLogger.resume", () => {
  it("stop 후 resume 하면 다시 기록·전송한다 (StrictMode 대비)", async () => {
    vi.useFakeTimers();
    const sent: EventBatch[] = [];
    const logger = new EventLogger({ observationId: "obs", clientSessionId: "s", transport: { send: async (b) => { sent.push(b); return {}; } } });
    logger.stop();
    logger.log("video_play", {}, 0);
    expect(logger.pendingCount).toBe(0);
    logger.resume();
    logger.log("video_play", {}, 0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sent).toHaveLength(1);
    vi.useRealTimers();
  });
});
