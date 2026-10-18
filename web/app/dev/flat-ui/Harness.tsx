"use client";

/**
 * /dev/flat-ui?surface=bag|chest|crafting|collection|collection-applicant|decorate|wallet (specs/polish/flat-ui.md): one in-game menu over a
 * plain sky, on the in-memory services, for the rollout's before and after shots. Add `collections=demo` (the bag, the
 * chest with `chest=1`, the collection; `bag=<slots>` fills the pockets) or `crafting=demo` (the workbench). The
 * economy's inventory (what you own: the bag's second shelf, the decorate catalogue) is answered here.
 */
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
    {/* Docked at the side as the world docks it (its --hud-* edges). */}
    {surface === "decorate" && <div style={{ position: "fixed", inset: 0, ["--hud-edge" as string]: "16px", ["--hud-side-bottom" as string]: "96px" }}>
      <DecorateSheet indoor selected={q.get("pick") ? { piece: q.get("pick")!, rot: 0 } : null} layout={layout} room={layout.rooms[0]}
        onChoose={close} onRotate={close} onPutAway={close} onDone={close} onFinish={close} onShop={close} />
    </div>}
  </main>;
}
