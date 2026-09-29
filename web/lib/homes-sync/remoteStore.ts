/**
 * Home layout store: { getSnapshot, subscribe, set, reset }, backed by
 * /api/homes with localStorage as an offline cache.
 *
 *   // lib/homes/useHomeLayout.ts (island agent)
 *   const store = createRemoteHomeStore({ cache: () => window.localStorage });
 *   useEffect(() => { void store.hydrate(); }, []);
 *
 * Edits apply locally at once and save after a short debounce. Each edit
 * gets one save key, reused on retry, so a flaky network never double-saves.
 * A conflict (edited on another device) adopts the server's document.
 */
import { newKey } from "@/lib/apiClient";
import { defaultLayout, parseLayout, serialiseLayout, withRooms, type HomeLayoutDoc } from "@/lib/homes/layout";

export const HOME_LAYOUT_KEY = "tsi.home.layout.v1";
export const HOME_META_KEY = "tsi.home.meta.v1";
type Cache = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type SyncStatus = "local" | "saving" | "saved" | "offline" | "conflict" | "error";

interface ServerHome {
  rooms_count: number;
  layout: HomeLayoutDoc;
  revision: number;
  room_price?: number;
  room_cap?: number;
}

export interface RemoteHomeStoreOptions {
  cache: () => Cache | null;
  fetchImpl?: typeof fetch;
  debounceMs?: number;
  newKey?: () => string;
}

export function createRemoteHomeStore(opts: RemoteHomeStoreOptions) {
  const doFetch = (...args: Parameters<typeof fetch>) => (opts.fetchImpl ?? fetch)(...args);
  const debounceMs = opts.debounceMs ?? 800;
  const makeKey = opts.newKey ?? newKey;
  const listeners = new Set<() => void>();
  let snapshot: HomeLayoutDoc | null = null;
  let revision = 0;
  let roomsCount = 1;
  let roomPrice: number | null = null;
  let pending: { doc: HomeLayoutDoc; key: string } | null = null;
  let status: SyncStatus = "local";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing: Promise<void> | null = null;

  const readCache = () => {
    try {
      const raw = opts.cache()?.getItem(HOME_LAYOUT_KEY);
      const meta = JSON.parse(opts.cache()?.getItem(HOME_META_KEY) ?? "{}") as { revision?: number; dirtyKey?: string };
      if (typeof meta.revision === "number") revision = meta.revision;
      const doc = raw ? parseLayout(JSON.parse(raw)) : defaultLayout();
      if (meta.dirtyKey) pending = { doc, key: meta.dirtyKey };
      return doc;
    } catch {
      return defaultLayout();
    }
  };
  const writeCache = () => {
    try {
      const c = opts.cache();
      if (snapshot) c?.setItem(HOME_LAYOUT_KEY, serialiseLayout(snapshot));
      c?.setItem(HOME_META_KEY, JSON.stringify({ revision, dirtyKey: pending?.key }));
    } catch {
      /* Private mode: this session only. */
    }
  };
  const publish = () => listeners.forEach((l) => l());
  const setStatus = (s: SyncStatus) => {
    status = s;
    publish();
  };
  const adopt = (home: ServerHome) => {
    snapshot = parseLayout(home.layout);
    revision = home.revision;
    roomsCount = home.rooms_count;
    if (typeof home.room_price === "number") roomPrice = home.room_price;
    pending = null;
    writeCache();
  };

  async function flushOnce(): Promise<void> {
    if (!pending) return;
    const job = pending;
    setStatus("saving");
    let res: Response;
    try {
      res = await doFetch("/api/homes/layout", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layout: job.doc, base_revision: revision, save_key: job.key }) });
    } catch {
      setStatus("offline");
      schedule(5000); // same key on retry
      return;
    }
    const body = (await res.json().catch(() => null)) as { ok?: boolean; saved?: { revision: number }; home?: ServerHome } | null;
    if (res.ok && body?.ok && body.saved) {
      revision = body.saved.revision;
      if (pending?.key === job.key) pending = null;
      writeCache();
      setStatus(pending ? "local" : "saved");
      if (pending) schedule(debounceMs);
      return;
    }
    if (res.status === 409 && body?.home) {
      adopt(body.home);
      setStatus("conflict");
      return;
    }
    if (res.status === 401 || res.status === 503) {
      setStatus("offline"); // keep local; next edit or hydrate retries
      return;
    }
    pending = null; // 4xx: this edit can't be saved as-is
    writeCache();
    setStatus("error");
  }

  function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!flushing) flushing = flushOnce().finally(() => (flushing = null));
    return flushing;
  }
  function schedule(ms: number) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), ms);
  }

  return {
    getSnapshot(): HomeLayoutDoc {
      return (snapshot ??= readCache());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: HomeLayoutDoc) {
      snapshot = next;
      pending = { doc: next, key: makeKey() };
      writeCache();
      setStatus("local");
      schedule(debounceMs);
    },
    reset() {
      this.set(withRooms({ ...defaultLayout(), outdoor: [] }, roomsCount));
    },
    /** Load the server copy. Unsaved local edits (e.g. made offline) are pushed instead. */
    async hydrate(): Promise<SyncStatus> {
      this.getSnapshot();
      let res: Response;
      try {
        res = await doFetch("/api/homes");
      } catch {
        setStatus("offline");
        return status;
      }
      const body = (await res.json().catch(() => null)) as { ok?: boolean; home?: ServerHome } | null;
      if (!res.ok || !body?.ok || !body.home) {
        setStatus("offline");
        return status;
      }
      if (pending) {
        revision = body.home.revision;
        roomsCount = body.home.rooms_count;
        roomPrice = body.home.room_price ?? roomPrice;
        await flush();
      } else {
        adopt(body.home);
        setStatus("saved");
      }
      return status;
    },
    /** Buy the next room at the price the UI showed; the server re-checks price, cap and coins. */
    async buyRoom(expectedPrice: number): Promise<{ ok: true; coins: number } | { ok: false; error: string; code?: string }> {
      if (pending) await flush();
      const key = makeKey();
      for (let attempt = 0; attempt < 3; attempt++) {
        let res: Response;
        try {
          res = await doFetch("/api/homes/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expected_price: expectedPrice, idempotency_key: key }) });
        } catch {
          continue; // same key: a purchase that landed is replayed, not repeated
        }
        const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; code?: string; purchase?: { coins: number; home: ServerHome } } | null;
        if (res.ok && body?.ok && body.purchase) {
          adopt(body.purchase.home);
          setStatus("saved");
          return { ok: true, coins: body.purchase.coins };
        }
        return { ok: false, error: body?.error ?? "Couldn't buy a room.", code: body?.code };
      }
      return { ok: false, error: "Couldn't reach the server.", code: "offline" };
    },
    getStatus: () => status,
    getRoomPrice: () => roomPrice,
    getRevision: () => revision,
    flush,
  };
}
