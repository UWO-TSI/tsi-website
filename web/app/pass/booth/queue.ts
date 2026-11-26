/**
 * The booth's upload queue in IndexedDB, so photos taken while the venue connection is down survive a reload and upload
 * when it comes back.
 */
const DB = "genesis-booth", STORE = "photos";

function open(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((ok, fail) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  }));
}

let flushing = false;

export const photoQueue = {
  add: (id: string, blob: Blob) => run("readwrite", (s) => s.put(blob, id)),
  /** Upload what's queued, oldest first, stopping at the first failure. Returns how many are left. */
  async flush(upload: (id: string, blob: Blob) => Promise<boolean>): Promise<number> {
    const ids = (await run("readonly", (s) => s.getAllKeys())) as string[];
    if (flushing) return ids.length;
    flushing = true;
    try {
      let left = ids.length;
      for (const id of ids) {
        const blob = (await run("readonly", (s) => s.get(id))) as Blob | undefined;
        if (blob && !(await upload(id, blob).catch(() => false))) break;
        await run("readwrite", (s) => s.delete(id));
        left -= 1;
      }
      return left;
    } finally { flushing = false; }
  },
};
