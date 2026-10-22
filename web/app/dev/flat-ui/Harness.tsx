"use client";

/**
 * /dev/flat-ui?surface=bag|chest|crafting|collection|collection-applicant|decorate|wallet|missions|wardrobe|creator|creator-applicant
 * (specs/polish/flat-ui.md): one in-game
 * menu over a plain sky, on the in-memory services, for the rollout's before and after shots. The mission board takes
 * `mission=<id>` (that one under way, `done=1` ready to claim) and `cool=<id>` (that one on its cooldown). Add `collections=demo` (the bag, the
 * chest with `chest=1`, the collection; `bag=<slots>` fills the pockets) or `crafting=demo` (the workbench). The
 * economy's inventory (what you own: the bag's second shelf, the decorate catalogue) is answered here.
 */
import { setUiTheme, UI_THEMES } from "@/styles/themes";
import { useEffect, useState } from "react";
import { useSearch } from "@/lib/game/useMediaQuery";
import { routeDemoFetch, reply } from "@/lib/game/demoFetch";
import { installCollectionsDemo } from "@/lib/game/collectionsDemo";
import { memoryEconomyStore } from "@/lib/wallet/memoryStore";
import * as S from "@/lib/wallet/service";
import { defaultLayout } from "@/lib/homes/layout";
import { BagSheet } from "@/components/game/Bag";
import { ChestSheet } from "@/components/game/ChestSheet";
import CollectionBook from "@/components/game/CollectionBook";
import CraftingSheet from "@/components/game/crafting/Workshop";
import DecorateSheet from "@/components/game/home/DecorateSheet";
import { WalletSheet } from "@/components/economy/EconomySheets";
import MissionBoardSheet from "@/components/game/combat/MissionBoardSheet";
import { MISSIONS } from "@/lib/game/combat/data";
import { startMission } from "@/lib/game/combat/missions";
import { setMission } from "@/lib/game/combat/runtime";
import WardrobeSheet from "@/components/game/peaceful/WardrobeSheet";
import CharacterCreator from "@/components/game/character/CharacterCreator";
import { DEFAULT_LOOK } from "@/lib/game/character/look";

const ME = "00000000-0000-4000-8000-000000000001";
let routed = false;
/** What the demo member owns (tools, clothes, furniture, finishes), behind /api/economy/inventory and equip. */
async function routeInventory() {
  if (routed) return;
  routed = true;
  const m = memoryEconomyStore();
  m.fund(ME, 5000, 900);
  const now = new Date();
  const id = (slug: string) => m.items.find(i => i.slug === slug)!.id;
  let n = 0;
  for (const [slug, qty] of [["rod-basic", 1], ["rod-cedar", 1], ["net-basic", 1], ["shovel-basic", 1], ["outfit-sage-overalls", 1], ["outfit-club-tee", 1], ["acc-round-glasses", 1],
    ["hair-sunset", 1], ["furn-lounge-sofa", 1], ["furn-floor-lamp", 2], ["furn-plant-monstera", 3], ["furn-bookshelf", 1], ["furn-study-desk", 1], ["furn-wall-clock", 1],
    ["furn-lounge-rug", 1], ["wall-stripe", 1], ["floor-tatami", 1]] as const) {
    await S.buy(m.store, ME, { item_id: id(slug), qty, idempotency_key: `flat-${n++}` }, now);
  }
  await S.equip(m.store, ME, { item_id: id("outfit-sage-overalls"), equipped: true });
  // The board's cooldowns (none on the in-memory services otherwise).
  const cool = new URLSearchParams(location.search).get("cool");
  routeDemoFetch("/api/combat/missions", async path => path === "/api/combat/missions"
    ? reply({ ok: true, data: MISSIONS.map(m => ({ key: m.id, can_start: m.id !== cool, cooldown_until: m.id === cool ? new Date(Date.now() + 14 * 3_600_000).toISOString() : null })) }, "missions") : null);
  routeDemoFetch("/api/economy/", async (path, body, _url, method) => {
    if (path === "/api/economy/inventory") return reply(await S.getInventory(m.store, ME), "inventory");
    if (path === "/api/economy/equip" && method === "POST") return reply(await S.equip(m.store, ME, body), "equip");
    return null;
  });
}

export default function Harness() {
  const search = useSearch();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (search === null) return;
    installCollectionsDemo();
    const q = new URLSearchParams(search), id = q.get("mission"), def = MISSIONS.find(m => m.id === id);
    if (def) { const m = startMission(def); setMission(q.get("done") ? { ...m, status: "complete", note: "Done. Claim it at the board." } : m); }
    void routeInventory().then(() => setReady(true));
  }, [search]);
  if (search === null || !ready) return null;
  const q = new URLSearchParams(search);
  const surface = q.get("surface") ?? "bag";
  const close = () => undefined;
  const layout = defaultLayout();
  return <main className="gui" style={{ minHeight: "100dvh", background: "linear-gradient(180deg,#a9d8e6,#cfe7cf 55%,#9cc58f)" }}>
    {surface === "bag" && <BagSheet open onClose={close} keys="i" />}
    {surface === "chest" && <ChestSheet open onClose={close} />}
    {surface === "collection" && <CollectionBook open onClose={close} />}
    {/* The applicant island's card (recruitment keeps its look): shot to show it unchanged. */}
    {surface === "collection-applicant" && <CollectionBook open onClose={close} collectionScope="applicant" />}
    {surface === "crafting" && <CraftingSheet />}
    {surface === "wallet" && <WalletSheet open onClose={close} />}
    {surface === "missions" && <MissionBoardSheet open onClose={close} gateNote={null} />}
    {/* The closet (the fitting room with place=fitting), and the member's first creator as a signed-in member sees it. */}
    {surface === "wardrobe" && <WardrobeSheet open place={q.get("place") === "fitting" ? "fitting" : "closet"} onClose={close} onShop={close} />}
    {surface === "creator" && <CharacterCreator flat initial={DEFAULT_LOOK} askName={{ current: "You" }} onDone={close} />}
    {/* The applicant island's creator, as ApplicantIsland mounts it: shot to show it unchanged. */}
    {surface === "creator-applicant" && <CharacterCreator initial={DEFAULT_LOOK} title="Make yourself at home" onDone={close} />}
    {/* Docked at the side as the world docks it (its --hud-* edges). */}
    {surface === "decorate" && <div style={{ position: "fixed", inset: 0, ["--hud-edge" as string]: "16px", ["--hud-side-bottom" as string]: "96px" }}>
      <DecorateSheet indoor selected={q.get("pick") ? { piece: q.get("pick")!, rot: 0 } : null} layout={layout} room={layout.rooms[0]}
        onChoose={close} onRotate={close} onPutAway={close} onDone={close} onFinish={close} onShop={close} />
    </div>}
    {/* The UI theme, flipped live (specs/polish/ui-themes.md); ?uitheme=<name> starts on one. */}
    <nav data-ui-theme-switch="" aria-label="UI theme" style={{ position: "fixed", right: 12, bottom: 12, zIndex: 999, display: "flex", gap: 6 }}>
      {UI_THEMES.map(t => <button key={t} type="button" onClick={() => setUiTheme(t)}>{t}</button>)}
    </nav>
  </main>;
}
