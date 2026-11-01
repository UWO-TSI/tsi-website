"use client";

/**
 * The flat kit's newer pieces in the showroom (components/gui/flat/pieces.tsx, paper.tsx), each with real game data
 * and a caption: its name, what it is for in a line, and where the game uses it (round 4, David: "refine so its also
 * easy to understand").
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import { Clock, Droplets, Leaf, MapPin, Ruler, Sun, Sunset, Waves } from "lucide-react";
import { CurrencyIcon } from "@/components/economy/Amount";
import PixelImage from "@/components/economy/PixelImage";
import { Conditions, CoverTitle, FlatDialog, DarkButton, FoldedMenu, GachaReveal, InkArt, InkDefs, MenuDish, MonthDots, OddsTable, PanelSection, TaskCard, Thumb, TimeStrip, TipBody, useInkId, type OddsRow } from "@/components/gui/flat";
import { catchLanes } from "@/components/game/peaceful/CatchBoard";
import { COVER_LINE, dishStats } from "@/components/game/peaceful/SushiSheets";
import { SUSHI_MENU } from "@/lib/wallet/catalogue";
import { iconUrl } from "@/lib/icons/keys";
import { RARITY_LABEL, type Rarity } from "@/lib/rarity";
import { odds, prizeByKey } from "@/lib/wallet/tackle";

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "divine"];
const SAMPLE = ["fish_dace", "fish_salmon", "fish_pike", "fish_catfish", "fish_coelacanth", "fish_golden_koi"];
const LANE = { sea: { icon: <Waves />, label: "The sea", short: "Sea" }, river: { icon: <Droplets />, label: "The river", short: "River" } } as const;

/** One piece on show: its name, a line on what it is for, where the game uses it, then the piece. */
function Piece({ name, what, where, children }: { name: string; what: string; where: string; children: ReactNode }) {
  return <section style={{ display: "grid", gap: 12 }}>
    <header style={{ display: "grid", gap: 3 }}>
      <h3 style={{ margin: 0, font: "600 17px/1.2 var(--gui-font)" }}>{name}</h3>
      <p style={{ margin: 0, color: "var(--ui-ink-2)", font: "500 14px/1.4 var(--gui-font)" }}>{what}</p>
      <p style={{ margin: 0, color: "var(--ui-quiet)", font: "500 12px/1.4 var(--gui-font)" }}>Used in: {where}</p>
    </header>
    {children}
  </section>;
}

export default function FlatPieces() {
  const [dialog, setDialog] = useState(false), [roll, setRoll] = useState(0);
  const ink = useInkId();
  const lanes = catchLanes(["sea", "river"], 10, "clear").map(l => ({ id: l.water, ...LANE[l.water as "sea" | "river"], bands: l.bands }));
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
  return <div data-ui-theme="clean" data-gui-flat="" style={{ display: "grid", gap: 40, maxWidth: 1120, padding: 24, background: "var(--ui-panel)", borderRadius: 22, fontFamily: "var(--gui-font)", color: "var(--ui-ink)" }}>
    <Piece name="Thumb" what="An item's picture on a white tile. Its rarity is the thin edge; the number is how many; the dot means leaving soon. Hover one for its card." where="the catch board, the fish market's monthly board, the tackle counter's prizes">
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        {RARITIES.map((r, i) => <Thumb key={r} picture={iconUrl(SAMPLE[i])} rarity={r} size={64} count={i + 1} mark={i === 2} label={r}
          tip={<TipBody picture={iconUrl(SAMPLE[i])} rarity={r} kind={RARITY_LABEL[r]} name={SAMPLE[i].slice(5)} facts={[[<Clock key="c" size={14} />, "All day"], [<MapPin key="m" size={14} />, "River"], [<Ruler key="r" size={14} />, "10 to 18 cm"]]}>
            <MonthDots on={[9, 10, 11]} now={10} />
          </TipBody>} />)}
        <Thumb picture={iconUrl("fish_dace")} size={64} dim label="Not out now" />
        <span style={{ color: "var(--ui-quiet)", font: "500 13px var(--gui-font)" }}>Faded: not out right now.</span>
      </div>
    </Piece>
    <Piece name="Conditions" what="What is true right now, as soft chips: each an icon, a quiet word for what it is, and its value." where="the top of the catch board">
      <Conditions items={[{ icon: <Leaf />, label: "Season", value: "Autumn, October" }, { icon: <Sun />, label: "Weather", value: "Clear" }, { icon: <Sunset />, label: "Time of day", value: "Evening" }]} />
    </Piece>
    <Piece name="Time strip" what="The day from midnight to midnight, one lane a water. Each grey band is the hours its fish bite; the black line is now." where="the catch board">
      <TimeStrip now={14.5} lanes={lanes} label="Catch board" tip={f => <TipBody picture={f.picture} rarity={f.rarity} kind={f.rarity} name={f.label} />} />
    </Piece>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 28 }}>
      <Piece name="Odds table" what="A roll's chances: each rarity's share, and every prize in it with its own." where="the tackle counter (always in view when Gems are spent)">
        <OddsTable rows={rows} />
      </Piece>
      <Piece name="Task card" what="One task: the fish, how far along, what it pays, and one Claim once it's done." where="the task board, the fish market's tasks">
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <TaskCard picture={iconUrl("fish_dace")} rarity="common" title="Catch a Dace" have={1} need={1} reward={<>16 <CurrencyIcon size={15} /></>} claimed={false} onClaim={() => {}} />
          <TaskCard picture={iconUrl("fish_pike")} rarity="rare" title="Catch a Pike" have={0} need={1} reward={<>120 <CurrencyIcon size={15} /></>} claimed={false} onClaim={() => {}} />
          <TaskCard picture={iconUrl("fish_salmon")} rarity="uncommon" title="Catch a Salmon" have={1} need={1} reward={<>40 <CurrencyIcon size={15} /></>} claimed onClaim={() => {}} />
          <DarkButton onClick={() => setDialog(true)}>Open a small panel</DarkButton>
        </div>
      </Piece>
    </div>
    <Piece name="Reveal" what="The cards turning over after a roll, the best one last and bright." where="the tackle counter">
      <GachaReveal key={roll} items={won} />
      <div><DarkButton onClick={() => setRoll(r => r + 1)}>Roll again</DarkButton></div>
    </Piece>
    <Piece name="Folded menu (paper)" what="A real paper menu: the cover opens, the panels turn. Each dish is a photo with its name, price and what it does beside it." where="the sushi bar">
      <div style={{ display: "grid", placeItems: "center", padding: "10px 0 40px", "--h": "560px" } as CSSProperties}>
        <InkDefs id={ink} />
        <FoldedMenu label="A folded menu" cover={<CoverTitle filter={ink} title="Bancha" kind="Sushi bar" line={COVER_LINE} />}
          panels={[
            <PanelSection key="a" title="Nigiri and rolls">{dish("salmon_nigiri")}{dish("tuna_roll", true)}</PanelSection>,
            <div key="b" style={{ display: "grid", gap: 12 }}><InkArt kind="bamboo" filter={ink} /><InkArt kind="pagoda" filter={ink} /></div>,
          ]} />
      </div>
    </Piece>
    <FlatDialog open={dialog} onClose={() => setDialog(false)} title="A small panel"><p style={{ margin: 0 }}>One thing, one action.</p><DarkButton onClick={() => setDialog(false)}>Done</DarkButton></FlatDialog>
  </div>;
}
