/**
 * The main quest with no server, in dev and tests only (David's round 6 review: "make it work for tests"; his v5
 * playtest: signed out the first catch never ticked, so Juno never took it and the tutorial stuck there). The real
 * progression service runs on the in-memory store, its facts this browser's record of what you caught
 * (lib/game/collections.ts: the bag's stock and the size records, so a catch you sold still counts as caught). The
 * same rule as the sale's (lib/wallet/localEconomy.ts `offline`): a production build, or a dev server with Supabase,
 * never comes here.
 */
import { ApiError } from "@/lib/apiClient";
import { localCollections, localRecords } from "@/lib/game/collections";
import { releasedChapters } from "@/lib/game/drops";
import { DEFAULT_CHAPTERS } from "./defaults";
import { questFacts } from "./facts";
import { memoryStore } from "./memoryStore";
import { advanceChapter, loadState, type ServiceResult } from "./service";
import type { AdvanceAction } from "./chapters";
import type { ProgressionState } from "./types";

const ME = "00000000-0000-4000-8000-00000000c0de";
let mem: ReturnType<typeof memoryStore> | null = null;

/** The store, its facts made to match this browser's record (everything ever caught, the first fish first). */
function store() {
  if (!mem) { mem = memoryStore({ chapters: releasedChapters(DEFAULT_CHAPTERS) }); mem.addMember(ME); }
  const stock = localCollections(), records = localRecords();
  const rows = [...new Set([...Object.keys(stock), ...Object.keys(records)])].map(item_key => ({ item_key, total: Math.max(stock[item_key] ?? 0, 1), updated_at: null }));
  const { firstCatchKey, lastFishAt, counts, museum } = questFacts(ME, rows, [], false, []);
  mem.setFacts(ME, { firstCatchKey, lastFishAt, counts, museum });
  return mem.store;
}
const unwrap = <T>(r: ServiceResult<T>): T => {
  if (!r.ok) throw new ApiError(r.error, r.status, r.code);
  return r.data;
};

export const localState = async (): Promise<ProgressionState> => unwrap(await loadState(store(), ME, new Date()));
export const localAdvance = async (chapter_slug: string, action: AdvanceAction): Promise<ProgressionState> =>
  unwrap(await advanceChapter(store(), ME, { chapter_slug, action }, new Date()));

/** Tests: a fresh store. */
export const resetLocalProgression = () => { mem = null; };
