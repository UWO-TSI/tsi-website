/**
 * Dev-only demo for the companion page (?demo=tables|setup|focus|break|ended):
 * the real service over an in-memory store, replaying the last hour minute by
 * minute (with heartbeats) so each screen shows real server-derived state.
 */
import { memoryStudyStore } from "./memoryStore";
import { memoryStudyTransport } from "./memoryTransport";
import * as S from "./service";
import { DEFAULT_TABLES } from "./tables";

export const DEMO_ME = "00000000-0000-4000-8000-000000000001";
const MAYA = "00000000-0000-4000-8000-000000000101";
const JORDAN = "00000000-0000-4000-8000-000000000102";
const PRIYA = "00000000-0000-4000-8000-000000000103";
const LEO = "00000000-0000-4000-8000-000000000104";

export async function studyDemo(scenario: string) {
  const m = memoryStudyStore();
  for (const [id, n] of [[DEMO_ME, "You"], [MAYA, "Maya Chen"], [JORDAN, "Jordan Park"], [PRIYA, "Priya Shah"], [LEO, "Leo Martin"]]) m.name(id, n);
  const real = Date.now();
  let t = real - 60 * 60_000;
  const clock = () => new Date(t);
  const big = DEFAULT_TABLES.find((x) => x.slug === "cafe-four-1")!.id;
  const window1 = DEFAULT_TABLES.find((x) => x.slug === "cafe-window-1")!.id;
  const at = (minAgo: number) => real - minAgo * 60_000;
  const events: [number, () => Promise<unknown>][] = [
    [at(60), () => S.sit(m.store, PRIYA, { table_id: big, seat: 4 }, clock())],
    [at(60), () => S.sit(m.store, LEO, { table_id: window1, seat: 1 }, clock())],
    [at(38), async () => { await S.sit(m.store, MAYA, { table_id: big, seat: 2 }, clock()); await S.startSession(m.store, MAYA, { focus_len: 50, break_len: 10, cycles: 2 }, clock()); }],
    [at(27), async () => { await S.sit(m.store, JORDAN, { table_id: big, seat: 3 }, clock()); await S.startSession(m.store, JORDAN, { focus_len: 25, break_len: 5, cycles: 4 }, clock()); }],
  ];
  if (scenario === "ended") events.push([at(56), async () => { await S.sit(m.store, DEMO_ME, { table_id: big, seat: 1 }, clock()); await S.startSession(m.store, DEMO_ME, { focus_len: 25, break_len: 5, cycles: 1 }, clock()); }]);
  if (scenario === "focus" || scenario === "break") events.push([at(scenario === "break" ? 27 : 12), async () => { await S.sit(m.store, DEMO_ME, { table_id: big, seat: 1 }, clock()); await S.startSession(m.store, DEMO_ME, { focus_len: 25, break_len: 5, cycles: 4 }, clock()); }]);
  if (scenario === "setup") events.push([at(1), () => S.sit(m.store, DEMO_ME, { table_id: big, seat: 1 }, clock())]);
  events.sort((a, b) => a[0] - b[0]);
  for (const [when, run] of events) {
    while (t < when) {
      t = Math.min(when, t + 60_000);
      for (const s of await m.store.activeSessions()) await S.beat(m.store, s.member_id, clock());
    }
    await run();
  }
  while (t < real) {
    t = Math.min(real, t + 60_000);
    for (const s of await m.store.activeSessions()) await S.beat(m.store, s.member_id, clock());
  }
  m.setChatClock(real - 90_000);
  await m.store.insertChat(big, JORDAN, "Break time. Anyone else doing the stats midterm?");
  m.setChatClock(real - 40_000);
  await m.store.insertChat(big, PRIYA, "Me! Chapter 6 is rough.");
  m.setChatClock(real);
  await m.store.setBoardOptIn(MAYA, true);
  await m.store.setBoardOptIn(JORDAN, true);
  await m.store.setBoardOptIn(DEMO_ME, scenario === "ended");
  return memoryStudyTransport(DEMO_ME, () => new Date(), m).transport;
}
