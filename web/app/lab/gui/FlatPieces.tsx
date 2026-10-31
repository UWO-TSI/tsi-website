"use client";

/**
 * The flat kit's newer pieces in the showroom (components/gui/flat/pieces.tsx), each with real game data: the tiles and
 * their rarity edges, a hover card, the day strip, odds, the reveal, tasks, and paper with a menu row.
 */
import { useState, type CSSProperties } from "react";
import { Clock, MapPin, Ruler, Soup, Waves } from "lucide-react";
import { CurrencyIcon } from "@/components/economy/Amount";
import PixelImage from "@/components/economy/PixelImage";
import { FlatDialog, DarkButton, FoldedMenu, GachaReveal, Hanko, InkArt, InkDefs, InkTitle, MonthDots, OddsTable, PanelSection, TaskCard, Thumb, TimeStrip, TipBody, TrayDish, useInkId, type OddsRow } from "@/components/gui/flat";
import { catchLanes } from "@/components/game/peaceful/CatchBoard";
import { iconUrl } from "@/lib/icons/keys";
import { RARITY_LABEL, type Rarity } from "@/lib/rarity";
import { odds, prizeByKey } from "@/lib/wallet/tackle";

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "divine"];
const SAMPLE = ["fish_dace", "fish_salmon", "fish_pike", "fish_catfish", "fish_coelacanth", "fish_golden_koi"];

export default function FlatPieces() {
  const [dialog, setDialog] = useState(false), [roll, setRoll] = useState(0);
  const ink = useInkId();
  const lanes = catchLanes(["sea", "river"], 10, "clear").map(l => ({ id: l.water, icon: <Waves />, label: l.water, bands: l.bands }));
  const table = odds("gems", "autumn"), rows: OddsRow[] = (["legendary", "epic", "rare", "uncommon"] as const).map(r => ({
    rarity: r, label: RARITY_LABEL[r], chance: table.filter(o => o.prize.rarity === r).reduce((s, o) => s + o.chance, 0),
    items: table.filter(o => o.prize.rarity === r).map(o => ({ key: o.prize.key, picture: iconUrl(o.prize.icon), name: o.prize.name, chance: o.chance })),
  }));
  const won = ["bait_worm", "bobber_cork", "bait_shrimp", "bait_glow_grub", "bait_clam", "bobber_float", "bait_squid_jig", "bait_worm", "bobber_brass", "rod_pumpkin"].map(k => {
    const p = prizeByKey(k)!;
    return { key: k, picture: iconUrl(p.icon), name: p.name, rarity: p.rarity };
  });
  return <div data-ui-theme="clean" data-gui-flat="" style={{ display: "grid", gap: 28, maxWidth: 1120, padding: 24, background: "var(--ui-panel)", borderRadius: 22, fontFamily: "var(--gui-font)", color: "var(--ui-ink)" }}>
    <section style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      {RARITIES.map((r, i) => <Thumb key={r} picture={iconUrl(SAMPLE[i])} rarity={r} size={64} count={i + 1} mark={i === 2} label={r}
        tip={<TipBody picture={iconUrl(SAMPLE[i])} rarity={r} kind={RARITY_LABEL[r]} name={SAMPLE[i].slice(5)} facts={[[<Clock key="c" size={14} />, "All day"], [<MapPin key="m" size={14} />, "River"], [<Ruler key="r" size={14} />, "10 to 18 cm"]]}>
          <MonthDots on={[9, 10, 11]} now={10} />
        </TipBody>} />)}
      <Thumb picture={iconUrl("fish_dace")} size={64} dim label="Not out now" />
    </section>
    <TimeStrip now={14.5} lanes={lanes} label="Catch board" tip={f => <TipBody picture={f.picture} rarity={f.rarity} kind={f.rarity} name={f.label} />} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
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
      <FoldedMenu label="A folded menu" cover={<><InkTitle filter={ink} title="Bancha" side={<>Sushi<br />by the sea</>} />
        <div style={{ position: "relative" }}><Hanko filter={ink} /><InkArt kind="plum" filter={ink} fade="none" /></div></>}
        panels={[
          <PanelSection key="a" title="Nigiri and rolls">
            <TrayDish standIn picture={<PixelImage src={iconUrl("fish_salmon")} px={40} />} name="Salmon nigiri" price={<>40<CurrencyIcon size={12} /></>} does={<><Soup size={12} />Rarer fish, 20 min</>} />
            <TrayDish standIn open picture={<PixelImage src={iconUrl("fish_tuna")} px={40} />} name="Tuna roll" price={<>40<CurrencyIcon size={12} /></>} does={<><Soup size={12} />Bigger fish, 20 min</>}>Its action, when picked.</TrayDish>
          </PanelSection>,
          <div key="b" style={{ display: "grid", gap: 12 }}><InkArt kind="bamboo" filter={ink} /><InkArt kind="pagoda" filter={ink} /></div>,
        ]} />
    </div>
    <FlatDialog open={dialog} onClose={() => setDialog(false)} title="A small panel"><p style={{ margin: 0 }}>One thing, one action.</p><DarkButton onClick={() => setDialog(false)}>Done</DarkButton></FlatDialog>
  </div>;
}
