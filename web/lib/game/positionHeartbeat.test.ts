import { afterEach, describe, expect, it, vi } from "vitest";
import { createPositionHeartbeat, IDLE_HEARTBEAT_MS, POSITION_POLL_MS, sendPosition } from "./positionHeartbeat";
import { isPresenceCoordinate } from "./presencePosition";
import { pollPresence } from "./mobilePresence";
import { clampToCoast, ISLET } from "./coast";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const signal = () => new AbortController().signal;

describe("position heartbeat snapshots", () => {
  it("shares the initial position and retains the existing movement threshold", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const update = createPositionHeartbeat(send, () => 0);
    expect(await update({ x: 0, z: 0 }, signal())).toBe(true);
    expect(await update({ x: 0.5, z: 0 }, signal())).toBe(false);
    expect(await update({ x: 0.501, z: 0 }, signal())).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("records the coordinates actually sent even if the live player vector moves during the request", async () => {
    let finish!: () => void;
    const send = vi.fn().mockResolvedValue(undefined).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    const update = createPositionHeartbeat(send, () => 0);
    const position = { x: 1, z: 2 };
    const pending = update(position, signal());
    position.x = 8; position.z = 9;
    finish(); await pending;
    expect(send.mock.calls[0][0]).toEqual({ x: 1, z: 2 });
    expect(await update(position, signal())).toBe(true);
    expect(send.mock.calls[1][0]).toEqual({ x: 8, z: 9 });
  });

  it("retries after a failed acknowledgement instead of marking the position sent", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const update = createPositionHeartbeat(send);
    await expect(update({ x: 1, z: 2 }, signal())).rejects.toThrow("offline");
    expect(await update({ x: 1, z: 2 }, signal())).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("refreshes idle presence before the server's five-minute cutoff", async () => {
    let now = 0; const send = vi.fn().mockResolvedValue(undefined);
    const update = createPositionHeartbeat(send, () => now);
    await update({ x: 0, z: 0 }, signal());
    now = IDLE_HEARTBEAT_MS - 1; expect(await update({ x: 0, z: 0 }, signal())).toBe(false);
    now++; expect(await update({ x: 0, z: 0 }, signal())).toBe(true);
    expect(IDLE_HEARTBEAT_MS + POSITION_POLL_MS + 15_000).toBeLessThan(5 * 60_000);
  });

  it("does not accept a late result after cancellation", async () => {
    let finish!: () => void;
    const send = vi.fn().mockResolvedValue(undefined).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    const update = createPositionHeartbeat(send);
    const controller = new AbortController();
    const pending = update({ x: 1, z: 2 }, controller.signal);
    controller.abort(); finish(); expect(await pending).toBe(false);
    expect(await update({ x: 1, z: 2 }, signal())).toBe(true);
  });

  it("skips missing, invalid, out-of-range and already-canceled positions", async () => {
    const send = vi.fn().mockResolvedValue(undefined); const update = createPositionHeartbeat(send);
    for (const position of [null, { x: NaN, z: 0 }, { x: 0, z: Infinity }, { x: 81, z: 0 }]) expect(await update(position, signal())).toBe(false);
    const controller = new AbortController(); controller.abort();
    expect(await update({ x: 0, z: 0 }, controller.signal)).toBe(false); expect(send).not.toHaveBeenCalled();
  });

  it("retries after a timeout and prevents an ignored abort from overwriting the newer acknowledgement", async () => {
    vi.useFakeTimers(); let finish!: () => void;
    const send = vi.fn().mockResolvedValue(undefined).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    const update = createPositionHeartbeat(send, () => Date.now()); const position = { x: 0, z: 0 };
    const failed = vi.fn();
    const stop = pollPresence((requestSignal) => update(position, requestSignal), POSITION_POLL_MS, vi.fn(), failed);
    await vi.advanceTimersByTimeAsync(15_000); expect(failed).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][1].aborted).toBe(true);
    position.x = 4;
    await vi.advanceTimersByTimeAsync(POSITION_POLL_MS); expect(send).toHaveBeenCalledTimes(2);
    finish(); await vi.advanceTimersByTimeAsync(POSITION_POLL_MS);
    expect(send).toHaveBeenCalledTimes(2);
    stop(); expect(vi.getTimerCount()).toBe(0);
  });
});

it("sends the existing endpoint/body with an abort signal and propagates HTTP failure", async () => {
  const requestSignal = signal(); const fetcher = vi.fn().mockResolvedValueOnce(new Response('{"ok":true}')).mockResolvedValueOnce(new Response("", { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  await sendPosition({ x: -24, z: 72 }, requestSignal);
  expect(fetcher).toHaveBeenCalledWith("/api/positions/heartbeat", expect.objectContaining({ signal: requestSignal, method: "POST", body: '{"world_x":-24,"world_z":72}' }));
  await expect(sendPosition({ x: 0, z: 0 }, signal())).rejects.toMatchObject({ status: 503 });
});

it("covers the existing coast and islet walking bounds without accepting unbounded coordinates", () => {
  for (let i = 0; i < 720; i++) {
    const angle = i * Math.PI / 360;
    const [x, z] = clampToCoast(Math.cos(angle) * 1000, Math.sin(angle) * 1000, 50.6);
    expect(isPresenceCoordinate(x) && isPresenceCoordinate(z)).toBe(true);
    expect(isPresenceCoordinate(ISLET.x + Math.cos(angle) * ISLET.walkR)).toBe(true);
    expect(isPresenceCoordinate(ISLET.z + Math.sin(angle) * ISLET.walkR)).toBe(true);
  }
  expect(isPresenceCoordinate(80)).toBe(true); expect(isPresenceCoordinate(-80)).toBe(true);
  for (const value of [80.01, -80.01, Infinity, NaN, "5", null]) expect(isPresenceCoordinate(value)).toBe(false);
});
