"use client";

/**
 * The flat kit's newer pieces in the showroom (components/gui/flat/pieces.tsx, paper.tsx), each with real game data: the
 * tiles and their rarity edges, a hover card, the conditions, the day strip, odds, the reveal, tasks and the paper menu.
 */
import { useState, type CSSProperties } from "react";
import { Check, Clock, Clover, Droplets, Leaf, Lock, MapPin, Ruler, Sun, Sunset, Waves } from "lucide-react";
import { CurrencyIcon } from "@/components/economy/Amount";
import PixelImage from "@/components/economy/PixelImage";
import { BiomeTag, PLACE_LOOK, Conditions, FlatDialog, DarkButton, FoldedMenu, GachaReveal, InkArt, InkDefs, MenuDish, OddsTable, SeasonDots, PanelSection, TaskCard, Thumb, TimeStrip, TipBody, useInkId, BoostTrack, BuffChip, BookPage, BookSlot, GivenFish, PaperRow, type OddsRow } from "@/components/gui/flat";
import { catchLanes } from "@/components/game/peaceful/CatchBoard";
import { dishStats, MenuCover } from "@/components/game/peaceful/SushiSheets";
import { mealRows } from "@/components/economy/statIcons";
import { SUSHI_MENU, TASTING } from "@/lib/wallet/catalogue";
import { tastingPages } from "@/lib/wallet/rules";
import { iconUrl } from "@/lib/icons/keys";
import type { Place } from "@/lib/game/world/places";
import { RARITY_LABEL, type Rarity } from "@/lib/rarity";
import { odds, prizeByKey } from "@/lib/wallet/tackle";

const RIVER = tastingPages()[0].species;
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "divine"];
const SAMPLE = ["fish_dace", "fish_salmon", "fish_pike", "fish_catfish", "fish_coelacanth", "fish_golden_koi"];
const LANE = { sea: { icon: <Waves />, label: "The sea", short: "Sea" }, river: { icon: <Droplets />, label: "The river", short: "River" } } as const;

export default function FlatPieces() {
  const [dialog, setDialog] = useState(false), [roll, setRoll] = useState(0);
  const ink = useInkId();
  const lanes = catchLanes(["sea", "river"], "autumn", "clear", "winter").map(l => ({ id: l.water, ...LANE[l.water as "sea" | "river"], bands: l.bands }));
  const table = odds("gems", "autumn"), rows: OddsRow[] = (["legendary", "epic", "rare", "uncommon"] as const).map(r => ({
    rarity: r, label: RARITY_LABEL[r], chance: table.filter(o => o.prize.rarity === r).reduce((s, o) => s + o.chance, 0),
    items: table.filter(o => o.prize.rarity === r).map(o => ({ key: o.prize.key, picture: iconUrl(o.prize.icon), name: o.prize.name, chance: o.chance })),
  }));
  const won = ["bait_worm", "bobber_cork", "bait_shrimp", "bait_glow_grub", "bait_clam", "bobber_float", "bait_squid_jig", "bait_worm", "bobber_brass", "rod_pumpkin"].map(k => {
    const p = prizeByKey(k)!;
    return { key: k, picture: iconUrl(p.icon), name: p.name, rarity: p.rarity };
  });
  const dish = (id: string, open = false) => {
    const d = SUSHI_MENU.find(x => x.id === id)!;
    return <MenuDish key={id} standIn open={open} picture={<PixelImage src={iconUrl(id === "tuna_roll" ? "fish_tuna" : "fish_salmon")} px={64} />} name={d.name}
      price={<>{d.price}<CurrencyIcon size={13} /></>} stats={dishStats(d.buff)} note={d.blurb}>Its action, when picked.</MenuDish>;
  };
  return <div data-ui-theme="clean" data-gui-flat="" style={{ display: "grid", gap: 28, maxWidth: 1120, padding: 24, background: "var(--ui-panel)", borderRadius: 22, fontFamily: "var(--gui-font)", color: "var(--ui-ink)" }}>
    <section style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      {RARITIES.map((r, i) => <Thumb key={r} picture={iconUrl(SAMPLE[i])} rarity={r} size={64} count={i + 1} mark={i === 2} label={r}
        tip={<TipBody picture={iconUrl(SAMPLE[i])} rarity={r} kind={RARITY_LABEL[r]} name={SAMPLE[i].slice(5)} facts={[[<Clock key="c" size={14} />, "All day"], [<MapPin key="m" size={14} />, "River"], [<Ruler key="r" size={14} />, "10 to 18 cm"]]}>
          <SeasonDots on={["spring", "autumn"]} now="autumn" />
        </TipBody>} />)}
      <Thumb picture={iconUrl("fish_dace")} size={64} dim label="Not out now" />
    </section>
    <Conditions items={[{ icon: <Leaf />, label: "Season", value: "Autumn", tint: "amber", note: "Winter on Dec 21" }, { icon: <Sun />, label: "Weather", value: "Clear", tint: "sky" }, { icon: <Sunset />, label: "Time of day", value: "Evening", tint: "amber" }]} />
    <div style={{ display: "flex", gap: 8, margin: "0 0 14px" }}><BiomeTag water="sea" /><BiomeTag water="river" /><BiomeTag water="pond" /><BiomeTag water="sea" place="Wharf" /></div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 14px" }} data-testid="place-tags">{(Object.keys(PLACE_LOOK) as Place[]).map(at => <BiomeTag key={at} place={at} />)}</div>
    <TimeStrip now={14.5} lanes={lanes} label="Catch board" tip={f => <TipBody picture={f.picture} rarity={f.rarity} kind={f.rarity} name={f.label} />} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 22 }}>
      <OddsTable rows={rows} />
      <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
        <TaskCard picture={iconUrl("fish_dace")} rarity="common" title="Catch a Dace" have={1} need={1} reward={<>16 <CurrencyIcon size={15} /></>} claimed={false} onClaim={() => {}} />
        <TaskCard picture={iconUrl("fish_pike")} rarity="rare" title="Catch a Pike" have={0} need={1} reward={<>120 <CurrencyIcon size={15} /></>} claimed={false} onClaim={() => {}} />
        <TaskCard picture={iconUrl("fish_salmon")} rarity="uncommon" title="Catch a Salmon" have={1} need={1} reward={<>40 <CurrencyIcon size={15} /></>} claimed onClaim={() => {}} />
        <DarkButton onClick={() => setDialog(true)}>Open a small panel</DarkButton>
        <DarkButton onClick={() => setRoll(r => r + 1)}>Roll again</DarkButton>
      </div>
    </div>
    <GachaReveal key={roll} items={won} />
    <div style={{ display: "grid", placeItems: "center", padding: "20px 0 40px", "--h": "560px" } as CSSProperties}>
      <InkDefs id={ink} />
      <FoldedMenu label="A folded menu" cover={<MenuCover ink={ink} />}
        chapters={[{ label: "Collection", panel: 0 }, { label: "Menu", panel: 2 }]}
        panels={[
          <PanelSection key="c" title="Collection">
            <BoostTrack filter={ink} icon={<Clover />} value="+6%" label="permanent luck boost" filled={6} total={20} note="+1% a new fish, up to +20%." />
          </PanelSection>,
          <PanelSection key="g" title="Given">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {RIVER.slice(0, 5).map((k, i) => <GivenFish key={k} name={k.replace("fish_", "")} fresh={i === 0} picture={<PixelImage src={iconUrl(k)} px={40} />} gave={<><Clover size={10} /> Luck +1%</>} extra={i === 0 ? "Dace karaage" : undefined} />)}
            </div>
            <PaperRow art={<BookSlot name="dace" state="given" picture={<PixelImage src={iconUrl("fish_dace")} px={30} />} />} title="Dace karaage" detail="From your dace" end={<Check size={15} />} onClick={() => {}} />
            <PaperRow art={<BookSlot name="squid" state="empty" picture={<PixelImage src={iconUrl("fish_squid")} px={30} />} />} title="Squid tempura" detail="Give a squid" end={<Lock size={13} />} />
          </PanelSection>,
          <PanelSection key="a" title="Nigiri and rolls">{dish("salmon_nigiri")}{dish("tuna_roll", true)}</PanelSection>,
          <div key="b" style={{ display: "grid", gap: 12 }}><InkArt kind="bamboo" filter={ink} /><InkArt kind="pagoda" filter={ink} /></div>,
        ]} />
    </div>
    <div style={{ maxWidth: 380, padding: "18px 22px", borderRadius: 4, background: "var(--ui-paper)", color: "var(--ui-paper-ink)" }}>
      <BookPage title="River" filled={6} total={RIVER.length} note={<>A full page: {TASTING.full}<CurrencyIcon size={11} /></>}>
        {RIVER.map((k, i) => <BookSlot key={k} name={k} state={i < 6 ? "given" : "empty"} fresh={i === 4} picture={<PixelImage src={iconUrl(k)} px={36} />} />)}
      </BookPage>
    </div>
    {/* The HUD's meal buff (tasting-book r3): faint, on the right edge in the game; one stat and two here. */}
    <div data-testid="buff-showroom" style={{ display: "flex", gap: 18, alignItems: "flex-start", padding: 18, borderRadius: 14, background: "var(--ui-water-deep)" }}>
      <BuffChip stats={mealRows(TASTING.dishes[1].buff)} left="38m" title="Dace karaage: Reel speed +10%, 38 min left" />
      <BuffChip stats={mealRows(TASTING.dishes[0].buff)} left="12m" title="Snapper chazuke: Luck +10%, Bite window +10%, 12 min left" />
    </div>
    <FlatDialog open={dialog} onClose={() => setDialog(false)} title="A small panel"><p style={{ margin: 0 }}>One thing, one action.</p><DarkButton onClick={() => setDialog(false)}>Done</DarkButton></FlatDialog>
  </div>;
}
