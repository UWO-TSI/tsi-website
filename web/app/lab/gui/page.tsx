"use client";
/* eslint-disable @next/next/no-img-element -- a dev-only showroom of the real item icons */

/**
 * /lab/gui — the GUI sheet showroom (specs/polish/gui-sheet.md §1): every token and component in every state, each
 * beside a small crop of David's Animal Crossing UI kit (served from outside the repo by ./ref, dev only), then the
 * game's overlays standalone. Dev only (the lab layout 404s in production). `?only=<id>` shows one overlay full
 * screen, for screenshots.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Backpack, BookOpen, Coins, Fish, Mail, MapIcon, PackageOpen, Settings, ShoppingBasket, Sprout, Volume2 } from "lucide-react";
import FishReveal from "@/components/game/FishReveal";
import { FamilyReveal } from "@/components/game/oracle/OracleSheetEmbed";
import IncantationOverlay from "@/components/game/combat/IncantationOverlay";
import { EmoteWheelView } from "@/components/game/emotes/EmoteWheel";
import { DANCE_RING } from "@/lib/game/emoteWheel";
import ToastHub, { toast } from "@/components/game/ToastHub";
import { Amount } from "@/components/economy/Amount";
import { Badge, Banner, Button, Card, ConfirmDialog, Counter, Dialogue, Empty, ErrorNote, Field, IconButton, ItemTile, Keycap, List, ListRow, Loading, NameTag, Panel, Progress, Select,
  RarityBadge, Sheet, Slider, Tabs, TextArea, Toggle, Tooltip } from "@/components/gui";
import { FISH } from "@/lib/game/fishing";
import { iconUrl } from "@/lib/icons/keys";
import { RARITIES, RARITY_LABEL } from "@/lib/rarity";
import { RODS, TACKLE } from "@/lib/game/rods";
import { RodRadar, TackleRadar } from "@/components/economy/RodGear";
import { useSearch } from "@/lib/game/useMediaQuery";
import { CircleDot, Waves, Worm } from "lucide-react";
import { CatchCard, CatchTag, LineGauge, PowerMeter, ReelPanel, ReelTags, ReelTrack, StatusChip } from "@/components/gui/flat/reel";
import { ActionBar, ActionIcon, BigMoment, CardOverlay, DarkButton, FlyIn, GearSlot, GhostButton, ItemCard, KEYWORD_KINDS, KeyBoard, Keyword, KeywordLine, PaperField, PrintedCard, ProgressCard, QuestCheck, RankBadge, RewardPop, ServeMeter, SlotPop, SpinPicker, Spotlight, StatBar, StatBars, WalletSlot } from "@/components/gui/flat";
import type { Rarity } from "@/lib/rarity";
import { BoardRows } from "@/components/game/volleyball/BoardSheet";
import s from "./showroom.module.css";
import FlatRewards from "./FlatRewards";

/** The reward pop at each rung of the ladder, and a dig's purse (no rarity). */
const POPS: readonly (readonly [Rarity | null, string, string, string, string | null])[] = [
  ["common", "bug_common_butterfly", "Common Butterfly", "Caught", "6.2 cm"], ["uncommon", "find_old_coin", "Old Coin", "Dug up", "2.4 cm"],
  ["rare", "find_ammonite", "Ammonite", "New!", "11.2 cm"], ["epic", "find_amber", "Amber", "Dug up", "4.8 cm"],
  ["legendary", "find_broken_sudo", "Broken Sudo", "Dug up", null], ["divine", "find_trilobite", "Trilobite (divine)", "Dug up", "7.1 cm"],
  [null, "coin", "32 coins", "Dug up", null],
];

/** The rod radar and its pieces (flat kit): a rod's build sliding as the lucky bobber goes on, every rod alone, an
 * add-on's own radar, the gear slots, and the rarity outline on a card for each rung. */
function RodGearShow() {
  const [on, setOn] = useState(false);
  const bobber = TACKLE.find(t => t.slot === "bobber")!, bait = TACKLE.find(t => t.slot === "bait")!;
  return <>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24, alignItems: "end" }}>
      <div data-testid="radar-live"><b>Glass rod, your build</b><RodRadar rod={RODS[2]} tackle={on ? [bobber.key, bait.key] : []} />
        <GhostButton onClick={() => setOn(v => !v)} data-testid="radar-toggle">{on ? "Take the bobber and bait off" : "Put the lucky bobber and sweet bait on"}</GhostButton></div>
      <div><b>{bobber.name} on its own</b><TackleRadar tackle={bobber} /></div>
      <div style={{ display: "flex", gap: 8, alignSelf: "center" }}>
        <GearSlot label="Bait" icon={<Worm />} options={[]} empty="None yet. Bait is on the shop's Tools shelf." onPick={() => {}} />
        <GearSlot label="Bobber" icon={<CircleDot />} onPick={() => {}} empty=""
          options={[{ id: "b", name: bobber.name, picture: "/assets/icons/bobber-lucky.webp", line: "+20 Luck", on: true }]} />
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24, marginTop: 24 }}>
      {RODS.map(r => <div key={r.key}><b>{r.name}</b><RodRadar rod={r} /></div>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginTop: 24 }} data-testid="rarity-cards">
      {RARITIES.filter(r => r !== "contraband").map(r => <ItemCard key={r} size="md" arrow={false} rarity={r} picture={iconUrl("rod_glass")} name={RARITY_LABEL[r]} line="A rod at this rung" />)}
    </div>
  </>;
}

/** Re-mounts its child every `ms` (an overlay that finishes and closes itself stays on show). */
function Loop({ ms, children }: { ms: number; children: (done: () => void) => ReactNode }) {
  const [n, setN] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setN(v => v + 1), ms); return () => window.clearInterval(t); }, [ms]);
  return <div key={n} style={{ display: "contents" }}>{children(() => {})}</div>;
}

/** The kit's moments (components/gui/flat/moments.tsx), each looping through its states. */
function KeyBoardShow() {
  const [t, setT] = useState(0);
  useEffect(() => { const i = window.setInterval(() => setT(v => v + 1), 120); return () => window.clearInterval(i); }, []);
  const k = t % 40, hold = k < 20, bag = k >= 34;
  // The light card: the key and a word, the keys on their well; a press brings its part of the screen in (here the Bag, top left).
  return <>
    {bag && <span data-demo-bag style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 6, alignItems: "center", padding: "8px 14px", borderRadius: 999, background: "var(--ui-card)", fontWeight: 800 }}><Backpack size={16} /> Bag</span>}
    {bag && <SlotPop to={["[data-demo-bag]"]} />}
    <Spotlight light open label="Keys" lead={hold ? <>Hold <Keycap>Tab</Keycap> Tools</> : <>Press <Keycap>I</Keycap> Bag</>}
      steps={{ count: 9, at: hold ? 0 : 4 }} footer={<GhostButton>Skip</GhostButton>}>
      <KeyBoard lit={hold ? "tab" : "i"} hold={hold} fill={hold ? Math.min(1, Math.max(0, (k - 4) / 12)) : 0} won={hold ? k >= 16 : k >= 34}
        done={hold ? [] : ["tab", "g", "h", "enter"]} down={new Set(hold ? (k >= 4 && k < 16 ? ["tab"] : []) : (k >= 32 && k < 34 ? ["i"] : []))} />
    </Spotlight>
  </>;
}
/** The ID as the overlay: filled in on the card, printed out of the slot, stamped, then Done; hover it to tilt. */
function PrintedShow() {
  const [t, setT] = useState(0);
  useEffect(() => { const i = window.setInterval(() => setT(v => (v + 1) % 8), 1000); return () => window.clearInterval(i); }, []);
  const form = t < 3, printing = t >= 3 && t < 5, stamped = t >= 5;
  const rows: [string, ReactNode][] = form
    ? [["World name", <PaperField key="n" defaultValue="Marlowe" />], ["Birthday", <PaperField key="b" placeholder="March 14" />], ["From", <PaperField key="f" placeholder="Your hometown" />],
      ["About you", <PaperField key="a" placeholder="Say hi in a line" />]]
    : [["World name", "Marlowe"], ["Birthday", "March 14"], ["From", "Halifax"], ["About you", "Here for the fishing"], ["Friend code", "K7QM-4R2X"]];
  return <CardOverlay open label="Your island ID" action={<DarkButton>{form ? "Print my ID" : "Done"}</DarkButton>}>
    <PrintedCard key={form ? "a" : "b"} large tilt band="Tethos Island" kind="Resident" picture="M" printing={printing} stamp={stamped ? { top: "Tethos Island", word: "Resident" } : null} rows={rows} />
  </CardOverlay>;
}
/** Talk lines with their keywords (the kit's Keyword, the default for every talk line): each word the dictionary
 *  knows coloured, a little icon wiggling before it; under it every kind in the dictionary. */
function KeywordShow() {
  return <div style={{ display: "grid", alignContent: "end", justifyItems: "center", gap: 14, minHeight: "100%", padding: 24 }}>
    <p style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", maxWidth: 560 }}>
      {KEYWORD_KINDS.map(kind => <Keyword key={kind} kind={kind}>{kind}</Keyword>)}
    </p>
    <Dialogue speaker="Bram">
      <p style={{ margin: 0 }}><KeywordLine line="And that's the shop. Tools and clothes for the island, and real merch too. Fish sell at the fish market; my rod's yours." /></p>
    </Dialogue>
  </div>;
}
/** The wallet (design bible UI 8b) under a time pill: resting in the UI view, then a coin fly-in landing in its slot. */
function WalletShow() {
  const [t, setT] = useState(0);
  useEffect(() => { const i = window.setInterval(() => setT(v => (v + 1) % 6), 1200); return () => window.clearInterval(i); }, []);
  return <div style={{ position: "absolute", top: 16, right: 16, display: "grid", justifyItems: "end", gap: 8 }}>
    <span style={{ padding: "4px 11px", borderRadius: 999, background: "var(--ui-card)", fontWeight: 900 }}>2:22 PM</span>
    <WalletSlot coins={t < 3 ? 1240 : 1305} gems={35} at={t === 5 ? "out" : t >= 3 ? "in" : undefined} />
  </div>;
}

const OVERLAYS: { id: string; title: string; render: () => ReactNode }[] = [
  { id: "key-board", title: "Keys (a light Spotlight, KeyBoard and SlotPop)", render: () => <KeyBoardShow /> },
  { id: "wallet", title: "The wallet (WalletSlot), its slot under the time", render: () => <WalletShow /> },
  { id: "keyword", title: "Keywords in a line (Keyword)", render: () => <KeywordShow /> },
  { id: "fly-in", title: "Fly-in, into the wallet's slot", render: () => <Loop ms={3600}>{done => <><span style={{ position: "absolute", top: 16, right: 16 }}><WalletSlot coins={1240} gems={35} at="in" landing="coins" /></span>
    <FlyIn icon={<Coins size={52} />} name="Coins" text="For things on the island" to={['[data-hud-slot="coins"]']} onDone={done} /></>}</Loop> },
  { id: "quest-check", title: "Quest complete", render: () => <Loop ms={3000}>{() => <QuestCheck eyebrow="Quest complete" title="Walk with Bram" />}</Loop> },
  { id: "printed-card", title: "Printed card as the overlay (CardOverlay, PrintedCard, PaperField)", render: () => <PrintedShow /> },
  { id: "fish-reveal", title: "Fish reveal", render: () => <Loop ms={9000}>{done => <FishReveal fish={FISH.find(f => f.rarity === "rare") ?? FISH[0]} sizeCm={42} onDone={done} />}</Loop> },
  { id: "oracle-reveal", title: "Oracle reveal card", render: () => <FamilyReveal family="Warden" type="INFP" onContinue={() => {}} /> },
  { id: "rune", title: "Rune overlay", render: () => <Loop ms={30000}>{done => <IncantationOverlay runeId="cross" title="Cross" effect="A warding cross" onDone={done} onCancel={done} />}</Loop> },
  { id: "emotes", title: "Emote wheel", render: () => <EmoteWheelShow /> },
  { id: "flat-rewards", title: "Flat reward pieces (hearts, reward track, prize wheel, goal meter, quiet toast)", render: () => <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: 24 }}><FlatRewards /><ToastHub /></div> },
];

/** The emote wheel open (specs/v1-drop.md §3): the emotes with Clap chosen, then the dances, flipping every few seconds. */
function EmoteWheelShow() {
  const [dances, setDances] = useState(false);
  useEffect(() => { const t = window.setInterval(() => setDances(d => !d), 4000); return () => window.clearInterval(t); }, []);
  return <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
    <EmoteWheelView standalone ring={dances ? "dances" : "emotes"} choice={dances ? 6 : 2} last={DANCE_RING[0]} onFlip={() => setDances(d => !d)} />
  </div>;
}

/** A world-ish backdrop that also contains fixed-position overlays (the transform makes it their containing block). */
function Stage({ children, tall }: { children: ReactNode; tall?: boolean }) {
  return <div className={`gui ${s.stage}`} data-tall={tall || undefined}>{children}</div>;
}

/** One section: our pieces on the left, the kit's crop (or crops) on the right. */
function Section({ id, title, kit, note, children }: { id: string; title: string; kit?: string[]; note?: ReactNode; children: ReactNode }) {
  return <section id={id} className={s.section}>
    <header className={s.sectionHead}><h2>{title}</h2>{note && <p>{note}</p>}</header>
    <div className={s.sectionBody}>
      <div className={s.ours}>{children}</div>
      {kit && <aside className={s.kit} aria-label="From the Animal Crossing UI kit">
        <small>From the kit</small>
        {kit.map(k => <KitCrop key={k} name={k} />)}
      </aside>}
    </div>
  </section>;
}
function KitCrop({ name }: { name: string }) {
  const [missing, setMissing] = useState(false);
  return missing ? <p className={s.missing}>Kit crop “{name}” isn’t on this machine: run specs/evidence/gui-sheet/ref_crops.py.</p> : <img src={`/lab/gui/ref/${name}`} alt={`Kit: ${name}`} onError={() => setMissing(true)} />;
}
const Row = ({ label, children }: { label?: string; children: ReactNode }) => <div className={s.row}>{label && <span className={s.rowLabel}>{label}</span>}<div className={s.rowItems}>{children}</div></div>;

const SWATCHES: [string, string][] = [
  ["page", "Page"], ["paper", "Paper"], ["paper-hi", "Paper, light"], ["paper-warm", "Paper, warm"], ["paper-deep", "Paper, deep"], ["paper-edge", "Rule"], ["paper-line", "Line"],
  ["butter", "Butter"], ["highlight", "Highlighter"], ["ink-strong", "Ink, strong"], ["ink", "Ink"], ["ink-2", "Ink, soft"], ["muted", "Muted"], ["taupe", "Taupe (large only)"],
  ["sage", "Sage"], ["sage-deep", "Sage, deep"], ["sage-soft", "Sage, soft"], ["teal", "Teal (no text)"], ["teal-ink", "Teal ink"], ["teal-pill", "Name pill"], ["wood", "Wood"],
  ["wood-light", "Honey"], ["bark", "Bark"], ["coral", "Coral"], ["coral-ink", "Coral ink"], ["amber", "Amber"], ["orange", "Ribbon"], ["gold", "Gold"], ["grey", "Grey"],
  ["success", "Success"], ["warn", "Warn"], ["danger", "Danger"], ["info", "Info"], ["tethos-blue", "Tethos blue"], ["tethos-gold", "Tethos gold"],
];
const TYPE: [string, string][] = [["3xl", "36 · Island title"], ["2xl", "28 · Banner"], ["xl", "22 · Sheet title"], ["lg", "18 · Lead"], ["md", "15 · Body"], ["sm", "13 · Small"], ["xs", "12 · Tags (the floor)"]];

export default function GuiShowroom() {
  const search = useSearch();
  const only = search === null ? null : new URLSearchParams(search).get("only");
  const overlay = OVERLAYS.find(o => o.id === only);
  const [tab, setTab] = useState<"tools" | "outfits" | "furniture" | "specials">("tools");
  const [row, setRow] = useState(1);
  const [tile, setTile] = useState("fish_arowana");
  const [toggles, setToggles] = useState({ sound: true, hud: false });
  const [volume, setVolume] = useState(70);
  const [sheet, setSheet] = useState<null | "sm" | "md" | "lg" | "butter" | "oracle">(only === "sheet" ? "md" : null);
  const [confirm, setConfirm] = useState(false);
  const [moment, setMoment] = useState(only === "moment");
  if (overlay) return <Stage tall>{overlay.render()}</Stage>;

  return <main className={`gui ${s.page}`}>
    <header className={s.top}>
      <h1>Our GUI sheet</h1>
      <p>The member game, portal and companion, drawn from David’s Animal Crossing UI kit: warm paper, sage, wood and Tethos accents. Tokens in <code>styles/game-tokens.css</code>, pieces in <code>components/gui</code>.</p>
      <nav className={s.toc} aria-label="Sections">{["colour", "type", "paper", "buttons", "tabs", "lists", "tiles", "controls", "dialogue", "badges", "progress", "tooltips", "banners", "cards", "sheets", "states", "toasts", "rewards", "overlays", "fishing"].map(id => <a key={id} href={`#${id}`}>{id}</a>)}</nav>
    </header>

    <Section id="colour" title="Colour" kit={["palette"]} note="The kit’s creams and inks, with our sage, wood and the Tethos accents. Every text pair is AA (lib/gui/contrast.test.ts).">
      <div className={s.swatches}>{SWATCHES.map(([k, name]) => <figure key={k}><span style={{ background: `var(--gui-${k})` }} /><figcaption>{name}<small>--gui-{k}</small></figcaption></figure>)}</div>
    </Section>

    <Section id="type" title="Type" kit={["type"]} note="One rounded face (Nunito, self-hosted), 600 for text and 800 for titles; nothing under 12 px.">
      <div className={s.typeScale}>{TYPE.map(([k, label]) => <p key={k} style={{ fontSize: `var(--gui-text-${k})`, fontWeight: ["3xl", "2xl", "xl"].includes(k) ? 800 : 600 }}>{label}<small>--gui-text-{k}</small></p>)}</div>
    </Section>

    <Section id="paper" title="Paper, edges, radii, shadows" kit={["banner", "inventory"]} note="Painted by scripts/gui-paper.mjs (seeded): fibre grain, tumbling confetti, a wavy band edge, a torn edge and three cut-paper shapes.">
      <div className={s.paperGrid}>
        <figure><span className={s.texture} style={{ background: "var(--gui-grain) var(--gui-paper)" }} /><figcaption>Grain</figcaption></figure>
        <figure><span className={s.texture} style={{ background: "var(--gui-confetti) var(--gui-butter)" }} /><figcaption>Confetti</figcaption></figure>
        <figure><span className={s.edge} data-edge="wave" /><figcaption>Wave edge</figcaption></figure>
        <figure><span className={s.edge} data-edge="deckle" /><figcaption>Torn edge</figcaption></figure>
        <figure><span className={s.blob} style={{ maskImage: "var(--gui-blob-dialogue)", WebkitMaskImage: "var(--gui-blob-dialogue)" }} /><figcaption>Dialogue</figcaption></figure>
        <figure><span className={s.blob} style={{ maskImage: "var(--gui-blob-menu)", WebkitMaskImage: "var(--gui-blob-menu)", background: "var(--gui-butter)" }} /><figcaption>Menu box</figcaption></figure>
        <figure><span className={s.blob} style={{ maskImage: "var(--gui-blob-bag)", WebkitMaskImage: "var(--gui-blob-bag)" }} /><figcaption>Bag</figcaption></figure>
      </div>
      <Row label="Radii">{["sm", "md", "lg", "card", "paper", "blob", "tag"].map(r => <span key={r} className={s.radius} style={{ borderRadius: `var(--gui-r-${r})` }}>{r}</span>)}</Row>
      <Row label="Shadows">{["sm", "md", "lg"].map(h => <span key={h} className={s.radius} style={{ boxShadow: `var(--gui-shadow-${h})`, borderRadius: "var(--gui-r-card)" }}>{h}</span>)}</Row>
    </Section>

    <Section id="buttons" title="Buttons and keycaps" kit={["buttons", "keycaps"]} note="Pill actions in sage (primary), butter, cream and soft red; round brown keycaps, square ones for tab keys. Hover lifts, a press sinks.">
      <Row label="Pills"><Button>Primary</Button><Button variant="secondary">Butter</Button><Button variant="quiet">Cream</Button><Button variant="danger">Remove</Button><Button disabled>Disabled</Button></Row>
      <Row label="Small"><Button size="sm">Buy</Button><Button size="sm" variant="secondary" leadingKey="E">Talk</Button><Button size="sm" variant="quiet" leadingKey="B">Back</Button><Button size="sm" disabled>Sold out</Button></Row>
      <Row label="Focus"><span className={s.forceFocus}><Button size="sm">Focused</Button></span><span className={s.forceFocus}><IconButton label="Settings (focused)"><Settings size={18} aria-hidden /></IconButton></span></Row>
      <Row label="Icon buttons"><IconButton label="Mail" badge={2}><Mail size={18} aria-hidden /></IconButton><IconButton label="Sound"><Volume2 size={18} aria-hidden /></IconButton>
        <IconButton label="Settings"><Settings size={18} aria-hidden /></IconButton><IconButton label="Map" size="sm"><MapIcon size={16} aria-hidden /></IconButton>
        <IconButton label="Bag" size="lg" tone="butter"><Backpack size={24} aria-hidden /></IconButton><IconButton label="Go" tone="sage"><Sprout size={18} aria-hidden /></IconButton><IconButton label="Disabled" disabled><Coins size={18} aria-hidden /></IconButton></Row>
      <Row label="Keycaps"><Keycap>E</Keycap><Keycap>B</Keycap><Keycap>Tab</Keycap><Keycap>Space</Keycap><Keycap data-shape="square">[</Keycap><Keycap data-shape="square">]</Keycap></Row>
    </Section>

    <Section id="tabs" title="Tabs" kit={["tabs"]} note="The chosen tab is butter with the highlighter; arrows move, and in a dialog the menu’s [ and ] keys do too.">
      <Tabs label="Shop" value={tab} onChange={setTab} keyHints={["[", "]"]} tabs={[{ id: "tools", label: "Tools", icon: <img src={iconUrl("rod_cedar")} alt="" /> },
        { id: "outfits", label: "Outfits", icon: <img src={iconUrl("top_cardigan")} alt="" /> }, { id: "furniture", label: "Furniture", icon: <img src={iconUrl("lounge-sofa")} alt="" /> }, { id: "specials", label: "Today’s specials", badge: 3 }]} />
      <Row label="Plain"><Tabs label="Journal" value="quests" onChange={() => {}} tabs={[{ id: "quests", label: "Quests" }, { id: "chapters", label: "Chapters" }, { id: "museum", label: "Museum", disabled: true }]} /></Row>
    </Section>

    <Section id="lists" title="List rows" kit={["shop-row", "recipe"]} note="Dashed rules between rows, a dashed leader to the value, and for the chosen row the butter stripes and our pointing glove.">
      <List label="Shop">
        <ListRow icon={iconUrl("acc_cap")} title="Cap" detail="Accessory" leader value={<Amount n={350} />} onClick={() => setRow(0)} selected={row === 0} />
        <ListRow icon={iconUrl("acc_backpack")} title="Backpack" detail="Accessory" leader value={<Amount n={1200} />} onClick={() => setRow(1)} selected={row === 1} />
        <ListRow icon={iconUrl("lounge-tea")} title="Tea set" detail="Furniture" leader value={<Amount n={220} />} onClick={() => setRow(2)} selected={row === 2} />
        <ListRow icon={iconUrl("rod_glass")} title="Glass rod" detail="Premium · needs level 8" value="Locked" onClick={() => {}} disabled />
        <ListRow icon={iconUrl("rock_stone")} title="Stone" leader value={<><b>2</b> / 5</>} />
      </List>
    </Section>

    <Section id="tiles" title="Item tiles" kit={["inventory", "wheel"]} note="The real item icons on cream, a rarity edge, the stack count; a dot while new, a silhouette until found, the kit’s little dot for a free slot.">
      <div className={s.tiles}>
        {(["fish_dace", "fruit_pear", "fish_arowana", "bug_emperor_butterfly", "fish_coelacanth", "fish_golden_koi", "fish_barreleye"] as const).map((k, i) => <ItemTile key={k} icon={iconUrl(k)} name={k.replace(/^[a-z]+_/, "").replace(/_/g, " ")}
          rarity={RARITIES[i]} count={[1, 12, 2, 1, 1, 1, 1][i]} isNew={i === 4} selected={tile === k} onClick={() => setTile(k)} caption={RARITY_LABEL[RARITIES[i]]} />)}
        <ItemTile icon={iconUrl("fish_oarfish")} name="Oarfish" unknown caption="Not found" />
        <ItemTile name="" empty caption="Free slot" />
        <ItemTile icon={iconUrl("shovel-gold")} name="Golden shovel" size={56} caption="Small" />
      </div>
    </Section>

    <Section id="controls" title="Toggles, sliders and fields" kit={["bells"]} note="Settings rows: a switch, a slider with its value, a paper select, and the recruit kit’s fields in this sheet’s ink.">
      <div className={s.form}>
        <Toggle checked={toggles.sound} onChange={v => setToggles(t => ({ ...t, sound: v }))} hint="Music, ambience and effects">Sound</Toggle>
        <Toggle checked={toggles.hud} onChange={v => setToggles(t => ({ ...t, hud: v }))}>Show the full HUD</Toggle>
        <Toggle checked={false} onChange={() => {}} disabled hint="Not on this device">Keyboard lock</Toggle>
        <Slider label="Music" value={volume} onChange={setVolume} />
        <Select label="Quality" defaultValue="auto"><option value="auto">Auto · High</option><option value="light">Light</option><option value="high">High</option></Select>
        <Field label="Island name" placeholder="Tethos Island" hint="Shown on your plot sign" />
        <Field label="Display name" defaultValue="Ju" error="Names are 3 to 16 letters." />
        <TextArea label="A note for the club" rows={3} placeholder="Write something kind…" />
      </div>
    </Section>

    <Section id="dialogue" title="Dialogue" kit={["dialogue", "menu", "tutorial"]} note="Our painted speech paper with the coral name tag and the amber continue chevron (the recruit kit’s NPCDialogue, in this sheet’s scope).">
      <Dialogue speaker="Alice · HQ lead" onContinue={() => {}} continueLabel="Next"><p>Welcome to Tethos Island, <strong>Juniper</strong>! Your plot is waiting past the café.</p></Dialogue>
      <Row label="Name tags"><NameTag>Alice</NameTag><NameTag tone="sage">Rosa · Café</NameTag><NameTag tone="paper">Sable</NameTag></Row>
    </Section>

    <Section id="radar" title="Rod radar (flat kit)" note="lib/game/rods.ts: six stats out of 100, a light hex with an icon at each corner (hover for what it does). Your build in the chart colour with the rod alone faint behind; an add-on slides it linearly. The gear slots sit in your rod's stage corner; rarity is a thin outline.">
      <RodGearShow />
    </Section>

    <Section id="badges" title="Badges and counters" kit={["recipe", "phone"]} note="Status tags and the red count on a shoulder (nothing at zero).">
      <Row label="Badges"><Badge>Basic</Badge><Badge tone="sage">Owned</Badge><Badge tone="success">Done</Badge><Badge tone="warn">Ready</Badge><Badge tone="danger">Sold out</Badge><Badge tone="info">Event</Badge><Badge tone="gold">Daily selection</Badge><Badge tone="new">New!</Badge></Row>
      <Row label="Rarity">{RARITIES.map(r => <RarityBadge key={r} rarity={r}>{RARITY_LABEL[r]}</RarityBadge>)}</Row>
      <Row label="Counters"><Counter n={1} /><Counter n={4} /><Counter n={12} /><span className={s.note}>(0 shows nothing)</span><Counter n={0} /></Row>
      <Row label="Amounts"><Amount n={1240} /><Amount n={750} currency="gems" /></Row>
    </Section>

    <Section id="fishing" title="Fishing (flat)" note="The member island's fishing pieces (components/gui/flat/reel), in the clean theme: the status chip (the hook is the black one), the cast meter, the reel's water track with its window and the fish, the line gauge, and the catch card edged in its rarity (the last one building suspense, as a new species does before it develops).">
      <FishingPieces />
    </Section>

    <Section id="progress" title="Progress" note="XP green, mastery gold, HP coral, energy lilac, and the ult as a ring round its icon that glows when full.">
      <div className={s.form}>
        <Progress kind="xp" value={1125} max={1925} label="Level 7" showLabel valueText="1,125 / 1,925 XP" />
        <Progress kind="mastery" value={0.62} label="Mastery 4" showLabel valueText="62%" size={8} />
        <Progress kind="hp" value={64} max={100} label="Health" showLabel valueText="64 / 100" size={16} />
        <Progress kind="energy" value={40} max={100} label="Energy" showLabel valueText="40" />
        <Progress value={3} max={5} label="Chapter 1" showLabel valueText="3 of 5 steps" />
      </div>
      <Row label="Ult"><Progress kind="ult" value={0.3} label="Ultimate charging, 30%"><img src={iconUrl("staff-rune")} alt="" width={36} height={36} /></Progress>
        <Progress kind="ult" value={1} label="Ultimate ready"><img src={iconUrl("staff-rune")} alt="" width={36} height={36} /></Progress></Row>
    </Section>

    <Section id="progress-card" title="Progress card (flat)" note="The flat kit’s loading card: a white card, the stage in a quiet line, the real progress as a thin ink line.">
      <Row><ProgressCard icon={<Sprout size={24} />} title="Tethos Island" status="Sweeping the plaza…" value={0.42} label="Loading the island" />
        <ProgressCard title="Saving" status="Nearly there" value={0.9} label="Saving" /></Row>
    </Section>

    <Section id="serve-meter" title="Serve meter (flat)" note="The volleyball serve’s power: a triangle wide at the top, the fill warming from sea to coral to gold; it leans in and trembles as it fills, and flashes Max at the top.">
      <Row><ServeMeter value={0.3} label="Serve power"><Keycap>Hold</Keycap></ServeMeter><ServeMeter value={0.72} label="Serve power" /><ServeMeter value={0.97} label="Serve power, max" /></Row>
    </Section>

    <Section id="action-bar" title="Action bar (flat)" note="A match’s moves: each a pictogram, its key and its name. A slot that would connect glows; a press flashes it. The ground’s and the air’s rows swap in place.">
      <Row><ActionBar active="ground" flash={{ id: "set", n: 1, ok: true }} rows={{ ground: ["bump", "set", "call", "dive", "jump"].map((a, i) => ({ id: a, label: a[0].toUpperCase() + a.slice(1), keycap: ["Click", "E", "R-click", "Ctrl", "Space"][i], icon: <ActionIcon move={a} />, ready: a === "bump" })) }} /></Row>
      <Row><ActionBar active="air" rows={{ air: ["spike", "jumpset", "block"].map((a, i) => ({ id: a, label: ["Spike", "Jump set", "Block"][i], keycap: ["Click", "E", "R-click"][i], icon: <ActionIcon move={a} />, ready: a === "spike" })) }} /></Row>
      <Row>{["serve", "charge", "spin", "slide", "dash"].map(a => <ActionIcon key={a} move={a} size={40} />)}</Row>
    </Section>

    <Section id="spin-picker" title="Spin picker (flat)" note="Where on the ball the serve is hit: off centre to a side curves it, the top dives, the bottom floats.">
      <Row><SpinPicker x={0} y={0} picture="/assets/game/volleyball/ball-icon.png" label="Centre" /><SpinPicker x={0.6} y={0.4} picture="/assets/game/volleyball/ball-icon.png" label="Top right"><Keycap>R-click</Keycap></SpinPicker></Row>
    </Section>

    <Section id="rank" title="Rank badge and the leaderboard (flat)" note="A place in a ranking, the first in gold; the volleyball court’s board, its rows on hairlines and a Sample tag until phase 3.">
      <Row><RankBadge rank={1} /><RankBadge rank={2} /><RankBadge rank={10} /></Row>
      <BoardRows board={{ sample: true, rows: [{ rank: 1, name: "Kelpie", wins: 14, you: false }, { rank: 2, name: "Sandpiper", wins: 11, you: false }, { rank: 3, name: "Islander", wins: 9, you: true }] }} />
    </Section>

    <Section id="tooltips" title="Tooltips" kit={["wheel"]} note="The teal name pill with a tail, on hover and on keyboard focus.">
      <Row><Tooltip label="Open your mail (L)"><IconButton label="Mail"><Mail size={18} aria-hidden /></IconButton></Tooltip>
        <span className={s.tipShown}><Tooltip label="Cedar rod · Mid tier"><IconButton label="Rod"><Fish size={18} aria-hidden /></IconButton></Tooltip></span>
        <span className={s.tipShown}><Tooltip label="Below, too" place="bottom"><Button size="sm" variant="quiet">Hover me</Button></Tooltip></span></Row>
    </Section>

    <Section id="banners" title="Banners" kit={["banner", "bells"]} note="The shop’s butter band with our confetti and wavy edge; the notched ribbon for deadlines.">
      <Banner title="Today’s specials" ribbon="Until 11:59 PM" icon={<ShoppingBasket size={26} />}>Three things the shopkeeper set aside for you.</Banner>
      <Banner title="Chapter 1: Settle in" tone="sage" icon={<BookOpen size={26} />}>Claim your plot, catch something, report to HQ.</Banner>
      <Banner title="GENESIS week" tone="coral" ribbon="3 days left">The posters are up by the café.</Banner>
    </Section>

    <Section id="cards" title="Panels and cards" kit={["inventory"]} note="Paper cards, pinned notices with a little tilt and a pin, a torn foot; the recruit kit’s big panel.">
      <div className={s.cards}>
        <Card><b>Paper card</b><p>Plain paper on the page.</p></Card>
        <Card tone="butter"><b>Butter</b><p>A highlighted choice.</p></Card>
        <Card tone="sage"><b>Sage</b><p>Something done.</p></Card>
        <Card pinned tilt={-1.2}><b>Pinned notice</b><p>Help reopen the café: 40 wood.</p></Card>
        <Card pinned torn tilt={0.8}><b>Torn notice</b><p>Fishing derby, Saturday.</p></Card>
      </div>
      <Panel tone="cream"><b>Panel</b> (the recruit kit’s, for big surfaces).</Panel>
    </Section>

    <Section id="sheets" title="Sheets and confirm dialogs" kit={["inventory", "tutorial"]} note="The one dialog frame: a wavy header band, the close button, Escape and the opening key close it, focus stays inside, a soft paper sound, a scale-and-fade in and out; a bottom sheet on a phone.">
      <Row><Button size="sm" onClick={() => setSheet("sm")}>Small sheet</Button><Button size="sm" onClick={() => setSheet("md")}>Sheet</Button><Button size="sm" onClick={() => setSheet("lg")}>Wide sheet</Button>
        <Button size="sm" variant="secondary" onClick={() => setSheet("butter")}>Butter header</Button><Button size="sm" variant="quiet" onClick={() => setSheet("oracle")}>Oracle tone</Button>
        <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>Confirm dialog</Button></Row>
    </Section>

    <Section id="states" title="Loading, empty and error" kit={["inventory"]} note="Waiting says what for; empty says what’s missing and what to do; errors say what happened, never “empty”.">
      <div className={s.cards}>
        <Card><Loading label="Laying out your recipes…" /></Card>
        <Card><Empty icon={<PackageOpen size={34} />} title="Nothing in your bag yet" action={<Button size="sm" variant="quiet">Go fishing</Button>}>Catches, fruit and finds land here.</Empty></Card>
        <Card><Empty icon={<img src={iconUrl("yellow-message-mat")} alt="" />} title="No letters">When someone writes, it arrives here.</Empty></Card>
        <Card><ErrorNote onRetry={() => {}}>Your mail didn’t load. The connection dropped.</ErrorNote></Card>
      </div>
    </Section>

    <Section id="toasts" title="Toasts" note="The island’s toast lane in paper, with the real item icon.">
      <Row><Button size="sm" onClick={() => toast("You caught a dace! 14 cm.", iconUrl("fish_dace"))}>Catch toast</Button>
        <Button size="sm" variant="quiet" onClick={() => toast("A new room is ready. 1,240 TC left.", iconUrl("home-bed"))}>Room toast</Button>
        <Button size="sm" variant="quiet" onClick={() => toast("Your backpack is full.")}>Plain toast</Button></Row>
      <div className={s.toastStage}><ToastHub /></div>
    </Section>

    <Section id="hud-bars" title="The HUD's bars (flat kit)" note="specs/design-bible.md UI 8: health and XP always on, stamina on its own pill while it's used (warm and shaking once when it runs out). components/gui/flat StatBar and StatBars; the island's are components/game/HudBars.tsx.">
      <Row>
        <StatBars><StatBar kind="health" value={1} label="Health 100 of 100" /><StatBar kind="xp" value={0.42} label="Level 3" /></StatBars>
        <StatBars><StatBar kind="health" value={0.7} label="Health 70 of 100" /><StatBar kind="xp" value={0.42} badge="Lv 3" label="Level 3" /></StatBars>
        <StatBar kind="stamina" value={0.55} alone label="Stamina" />
        <StatBar kind="stamina" value={0} alone low label="Stamina run out" />
      </Row>
    </Section>

    <Section id="rewards" title="Rewards and moments (flat kit)" note="specs/design-bible.md UI 4 and 7: a reward pops with its rarity as the outline (divine: the holo); a level up is the big moment. components/gui/flat RewardPop and BigMoment.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
        {POPS.map(([rarity, key, name, title, facts]) => <RewardPop key={rarity ?? key} picture={iconUrl(key)} title={title} name={name} rarity={rarity}
          rarityLabel={rarity ? rarity[0].toUpperCase() + rarity.slice(1) : null} facts={facts ? <span>{facts}</span> : null} isNew={rarity === "rare"} note="The one-liner, quiet." testId={`pop-${rarity ?? key}`} />)}
      </div>
      <Row><Button size="sm" onClick={() => setMoment(true)}>Show the level up</Button></Row>
      {moment && <BigMoment kicker="Level up" big={2} title="You're level 2" onClose={() => setMoment(false)} testId="showroom-moment"
        items={[{ key: "quest", icon: <BookOpen size={18} />, title: "New quest: Odile's net", line: "Odile at the museum has a spare net." }]} />}
    </Section>

    <section id="overlays" className={s.section}>
      <header className={s.sectionHead}><h2>The game’s overlays</h2><p>The same components the island mounts, over a stand-in world.</p></header>
      {/* They are dialogs that re-open on a loop, so they step aside while a demo sheet is up (each re-open would take
          the top of the dialog stack, and Escape with it). */}
      {sheet === null && !confirm && OVERLAYS.map(o => <div key={o.id} className={s.overlay}><h3>{o.title}</h3><Stage>{o.render()}</Stage></div>)}
    </section>

    <Sheet open={sheet !== null} onClose={() => setSheet(null)} title={sheet === "oracle" ? "The Oracle" : sheet === "butter" ? "Shop" : "Settings"} eyebrow={sheet === "lg" ? "HQ" : undefined}
      size={sheet === "sm" ? "sm" : sheet === "lg" ? "lg" : "md"} tone={sheet === "butter" ? "butter" : sheet === "oracle" ? "oracle" : undefined} icon={sheet === "butter" ? <img src={iconUrl("shopping-cart")} alt="" /> : undefined}
      footer={<><Button size="sm" variant="quiet" onClick={() => setSheet(null)}>Close</Button><Button size="sm" onClick={() => setSheet(null)}>Save</Button></>} testId="showroom-sheet">
      <Tabs label="Settings" value={tab} onChange={setTab} tabs={[{ id: "tools", label: "Text" }, { id: "outfits", label: "Sound" }, { id: "furniture", label: "Keys" }]} />
      <div className={s.form} style={{ marginTop: 16 }}>
        <Toggle checked={toggles.sound} onChange={v => setToggles(t => ({ ...t, sound: v }))}>Sound</Toggle>
        <Slider label="Music" value={volume} onChange={setVolume} />
        <Field label="Island name" placeholder="Tethos Island" />
      </div>
    </Sheet>
    <ConfirmDialog open={confirm} title="Sell all 12 pears?" danger confirmLabel="Sell them" onConfirm={() => setConfirm(false)} onCancel={() => setConfirm(false)}>
      <p>You’ll get <Amount n={720} />. Locked items are skipped.</p>
    </ConfirmDialog>
  </main>;
}

/** The flat fishing pieces at rest, in the clean theme (they're live in the game: the loops write them every frame). */
function FishingPieces() {
  const card = (key: string, rarity: string, label: string, developed = true, build?: number) => (
    <CatchCard picture={iconUrl(key)} name={developed ? label : "???"} developed={developed} build={build} rarity={rarity} rarityLabel={rarity[0].toUpperCase() + rarity.slice(1)}
      rare={rarity !== "common" && rarity !== "uncommon"} label={label} tags={<CatchTag>New</CatchTag>} facts={<span>42 cm</span>} line="“A quiet catch from the river.”"
      action={{ label: developed ? "Continue" : "Show me", onClick: () => {} }} />
  );
  return <div data-ui-theme="clean" style={{ display: "grid", gap: 18, padding: 22, borderRadius: 18, background: "var(--ui-panel)" }}>
    <Row label="Status"><StatusChip icon={<Waves />}>Casting</StatusChip><StatusChip tone="wait" icon={<Fish />}>Waiting for a bite</StatusChip>
      <StatusChip tone="gold" icon={<Waves />}>Max cast!</StatusChip><StatusChip tone="alert" icon={<Fish />}>Hook it!</StatusChip></Row>
    <Row label="Cast meter"><ReelPanel><PowerMeter zone={0.08} value={0.55} hint="Hold, let go at the tip" /></ReelPanel><ReelPanel><PowerMeter zone={0.08} value={0.96} hint="Hold, let go at the tip" /></ReelPanel><ReelPanel><PowerMeter horizontal zone={0.08} value={0.55} hint="Hold, let go at the tip" /></ReelPanel><ReelPanel><PowerMeter horizontal zone={0.08} value={0.96} hint="Hold, let go at the tip" /></ReelPanel></Row>
    <Row label="Reel"><div style={{ display: "grid", gap: 12, width: 560 }}>
      <ReelPanel style={{ display: "grid", gap: 10 }}><ReelTags name="Dace" water="river" /><ReelTrack picture={iconUrl("fish_dace")} windowWidth={0.3} windowAt={0.2} fishAt={0.32} /><LineGauge value={0.45} marks={[0.25, 0.5, 0.75]} label="Catch progress" /></ReelPanel>
      <ReelPanel style={{ display: "grid", gap: 10 }}><ReelTags name="Dace" water="river" /><ReelTrack picture={iconUrl("fish_dace")} windowWidth={0.3} windowAt={0.1} fishAt={0.62} state="slip" /><LineGauge value={0.18} low marks={[0.25, 0.5, 0.75]} label="Catch progress" /></ReelPanel>
      <ReelPanel style={{ display: "grid", gap: 10 }}><ReelTags name="???" water="sea" /><ReelTrack picture={iconUrl("fish_carp")} unknown windowWidth={0.27} windowAt={0.55} fishAt={0.66} /><LineGauge value={0.86} near marks={[0.25, 0.5, 0.75]} label="Catch progress" /></ReelPanel>
    </div></Row>
    <Row label="Catch card"><div style={{ display: "grid", gap: 12 }}>{card("fish_dace", "common", "Dace")}{card("fish_carp", "rare", "Carp")}{card("fish_golden_koi", "divine", "Golden Koi")}{card("fish_catfish", "epic", "Catfish", false)}{card("fish_king_salmon", "epic", "King Salmon", false, 2000)}</div></Row>
  </div>;
}
