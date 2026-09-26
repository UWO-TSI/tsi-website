"use client";

/**
 * /dev/systems?view=journal|museum|trophies|home[&category=fish]
 * Runs the real collections/homes services against in-memory stores (the
 * same code the /api routes call) and renders their JSON as cards, so the
 * data contracts can be checked by eye. Not product UI: the island agent
 * renders the CollectionBook, museum and trophy case in-world.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import type { JournalPage, MuseumWing, Trophy } from "@/lib/collections/logic";
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { journal, museum, recordCatch, donate, trophies, setShowcase, type ShowcaseItem } from "@/lib/collections/service";
import type { Category } from "@/lib/collections/roster";
import { memoryHomesStore } from "@/lib/homes-sync/memoryStore";
import { buyRoom, loadHome, saveHome } from "@/lib/homes-sync/service";
import type { HomeRecord } from "@/lib/homes-sync/store";

const ME = "00000000-0000-4000-8000-000000000001";
const FRIENDS = [["00000000-0000-4000-8000-000000000101", "Maya Chen"], ["00000000-0000-4000-8000-000000000102", "Jordan Park"], ["00000000-0000-4000-8000-000000000103", "Priya Shah"]] as const;
const NOW = new Date("2026-09-24T21:30:00Z"); // Thursday 17:30 Toronto

interface Data {
  page: JournalPage;
  wings: MuseumWing[];
  trophies: Trophy[];
  showcase: (ShowcaseItem | null)[];
  home: HomeRecord & { room_price: number; room_cap: number };
  coins: number;
  refusal: string;
}

async function build(category: Category): Promise<Data> {
  const m = memoryCollectionsStore(() => NOW);
  m.name(ME, "You");
  FRIENDS.forEach(([id, n]) => m.name(id, n));
  const catches: [string, string, number | null][] = [
    [ME, "fish_dace", 16.4], [ME, "fish_carp", 62], [ME, "fish_catfish", 88], [ME, "fish_squid", 31], [ME, "fish_bluegill", 19], [ME, "sea_scallop", 12],
    [ME, "bug_firefly", null], [ME, "bug_ladybug", null], [ME, "flower_rose", null], [ME, "apple", null],
    [FRIENDS[0][0], "fish_coelacanth", 151], [FRIENDS[0][0], "fish_dace", 17.8], [FRIENDS[1][0], "fish_tuna", 231], [FRIENDS[1][0], "fish_carp", 66],
    [FRIENDS[2][0], "fish_salmon", 77], [FRIENDS[2][0], "fish_pike", 81], [FRIENDS[2][0], "bug_monarch_butterfly", null],
  ];
  for (const [who, key, size] of catches) await recordCatch(m.store, who, key, size);
  await donate(m.store, FRIENDS[0][0], "fish_dace", "donate-demo-1");
  await donate(m.store, ME, "fish_carp", "donate-demo-2");
  await donate(m.store, FRIENDS[2][0], "bug_monarch_butterfly", "donate-demo-3");
  await donate(m.store, ME, "bug_firefly", "donate-demo-4");
  const dup = await donate(m.store, FRIENDS[1][0], "fish_carp", "donate-demo-5");
  await setShowcase(m.store, ME, ["fish_catfish", "bug_firefly", "fish_dace"]);
  const moment = { hour: 17.5, month: 9, weather: "clear" as const };
  const [page, wings, t] = await Promise.all([journal(m.store, ME, category, moment), museum(m.store), trophies(m.store, NOW)]);

  const h = memoryHomesStore();
  h.setCoins(ME, 1200);
  const first = await loadHome(h.store, ME);
  if (first.ok) {
    const doc = first.data.layout;
    await saveHome(h.store, ME, { layout: { ...doc, rooms: [{ ...doc.rooms[0], wallpaper: "log00", items: [...doc.rooms[0].items, { uid: "rug", piece: "lounge-rug", cell: [1, 1], rot: 0 }, { uid: "clock", piece: "wall-clock", cell: [2, 0], rot: 0, wall: "n" }] }] }, base_revision: 0, save_key: "demo-save-1" });
  }
  const bought = await buyRoom(h.store, ME, { expected_price: 500, idempotency_key: "demo-room-1" });
  const home = await loadHome(h.store, ME);
  const { getShowcase } = await import("@/lib/collections/service");
  const sc = await getShowcase(m.store, ME);
  if (!page.ok || !wings.ok || !t.ok || !home.ok || !sc.ok) throw new Error("demo failed");
  return { page: page.data, wings: wings.data, trophies: t.data.trophies, showcase: sc.data, home: home.data, coins: bought.ok ? bought.data.coins : -1, refusal: dup.ok ? "" : dup.error };
}

const noSub = () => () => {};
const card: React.CSSProperties = { background: "#f8f7e9", color: "#293e3b", borderRadius: 16, padding: 16, border: "1px solid #5c746c40" };
const pill = (bg: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: bg });

export default function SystemsHarness() {
  const search = useSyncExternalStore(noSub, () => window.location.search, () => null);
  return search === null ? null : <Body params={new URLSearchParams(search)} />;
}

function Body({ params }: { params: URLSearchParams }) {
  const view = params.get("view") ?? "journal";
  const category = (params.get("category") ?? "fish") as Category;
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    void build(category).then(setData);
  }, [category]);
  if (!data) return <p style={{ padding: 24 }}>Loading…</p>;
  return (
    <main style={{ minHeight: "100dvh", padding: 24, background: "linear-gradient(180deg,#a9d8e6,#cfe7cf)", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        {view === "journal" ? <Journal page={data.page} /> : null}
        {view === "museum" ? <Museum wings={data.wings} refusal={data.refusal} /> : null}
        {view === "trophies" ? <Trophies trophies={data.trophies} showcase={data.showcase} /> : null}
        {view === "home" ? <Home home={data.home} coins={data.coins} /> : null}
      </div>
    </main>
  );
}

function Journal({ page }: { page: JournalPage }) {
  return (
    <section style={card}>
      <h2 style={{ margin: "0 0 4px" }}>Journal · {page.category} ({page.discovered}/{page.total})</h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#607069" }}>GET /api/collections/journal?category={page.category} · Thu 17:30, clear, September</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {page.entries.map((e) => (
          <div key={e.slot} style={{ background: "#fff", borderRadius: 12, padding: 10, border: "1px solid #5c746c2e", display: "grid", gridTemplateColumns: "44px 1fr", gap: 8, alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.discovered ? (e.icon ?? "") : e.silhouette} alt="" width={40} height={40} style={{ filter: e.discovered ? "none" : "brightness(0) opacity(0.35)" }} />
            <div style={{ fontSize: 12, lineHeight: 1.35 }}>
              <b>{e.discovered ? e.name : `#${e.slot} ???`}</b>
              {e.discovered ? <div>{e.rarity} · best {e.best_size_cm ?? "–"} cm · ×{e.total_collected}{e.museum.donated ? ` · museum: ${e.museum.by_me ? "you" : e.museum.donor_name}` : ""}</div> : null}
              <div style={{ color: "#607069" }}>{e.clue}</div>
              {e.available_now ? <span style={pill("#cfe3c7")}>out now</span> : e.later_today ? <span style={pill("#f6ddb9")}>later today</span> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Museum({ wings, refusal }: { wings: MuseumWing[]; refusal: string }) {
  return (
    <section style={card}>
      <h2 style={{ margin: "0 0 4px" }}>Museum</h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#607069" }}>GET /api/collections/museum · duplicate donation reply: “{refusal}”</p>
      {wings.map((w) => (
        <div key={w.wing} style={{ marginBottom: 12 }}>
          <b>{w.wing.replace("_", " ")} · {w.donated}/{w.total}</b>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {w.exhibits.map((x) => (
              <div key={x.slot} title={x.name ?? "empty case"} style={{ width: x.donated ? 150 : 22, height: 40, borderRadius: 8, background: x.donated ? "#fff" : "#e4e8dc", border: "1px solid #5c746c2e", display: "flex", alignItems: "center", gap: 6, padding: x.donated ? "0 6px" : 0, fontSize: 11 }}>
                {x.donated ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.icon ?? ""} alt="" width={28} height={28} />
                    <span><b>{x.name}</b><br />by {x.donor_name}</span>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function Trophies({ trophies, showcase }: { trophies: Trophy[]; showcase: (ShowcaseItem | null)[] }) {
  return (
    <>
      <section style={card}>
        <h2 style={{ margin: "0 0 4px" }}>HQ trophy case · week of Sep 21</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#607069" }}>GET /api/collections/trophies · biggest per species, rarity then size-to-max, max 2 per member</p>
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
          {trophies.map((t) => (
            <li key={t.key} style={{ fontSize: 14 }}>
              <b>{t.name}</b> {t.size_cm} cm · {t.rarity} · {Math.round(t.size_ratio * 100)}% of max · caught by <b>{t.member_name}</b>
            </li>
          ))}
        </ol>
      </section>
      <section style={card}>
        <h2 style={{ margin: "0 0 8px" }}>Profile showcase</h2>
        <div style={{ display: "flex", gap: 10 }}>
          {showcase.map((s, i) => (
            <div key={i} style={{ width: 150, background: "#fff", borderRadius: 12, padding: 10, textAlign: "center", fontSize: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s ? <><img src={s.icon ?? ""} alt="" width={48} height={48} /><div><b>{s.name}</b></div><div>{s.rarity}{s.best_size_cm ? ` · ${s.best_size_cm} cm` : ""}</div></> : "empty"}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Home({ home, coins }: { home: HomeRecord & { room_price: number; room_cap: number }; coins: number }) {
  return (
    <section style={card}>
      <h2 style={{ margin: "0 0 4px" }}>Home persistence</h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#607069" }}>GET /api/homes after one save and one room purchase · revision {home.revision} · rooms {home.rooms_count}/{home.room_cap} · room price {home.room_price} coins · wallet after purchase {coins}</p>
      <pre style={{ margin: 0, fontSize: 11, background: "#fff", borderRadius: 12, padding: 12, overflow: "auto", maxHeight: 560 }}>{JSON.stringify(home.layout, null, 1)}</pre>
    </section>
  );
}
