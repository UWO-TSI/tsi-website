"use client";
/* eslint-disable @next/next/no-img-element -- a dev-only showroom of the real item icons */

/**
 * /lab/gui — the flat kit's showroom (specs/design-bible.md UI, "How it's built" 3; ledger row 334): every token and
 * component in every state, in the base theme (clean), then the game's overlays standalone. Dev only (the lab layout 404s in production). `?only=<id>` shows one overlay full
 * screen, for screenshots.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Backpack, BookOpen, Coins, Fish, Mail, MapIcon, PackageOpen, Settings, ShoppingBasket, Sprout, Volume2 } from "lucide-react";
import FlatPieces from "./FlatPieces";
import { FamilyReveal } from "@/components/game/oracle/OracleSheetEmbed";
import IncantationOverlay from "@/components/game/combat/IncantationOverlay";
import { EmoteWheelView } from "@/components/game/emotes/EmoteWheel";
import TourPeek from "@/components/game/hq/TourPeek";
import { DANCE_RING } from "@/lib/game/emoteWheel";
import ToastHub, { toast } from "@/components/game/ToastHub";
import { Amount } from "@/components/economy/Amount";
import { Badge, Banner, Button, Card, ConfirmDialog, Counter, Dialogue, Empty, ErrorNote, Field, IconButton, ItemTile, Keycap, List, ListRow, Loading, NameTag, Progress, Select,
  RarityBadge, Sheet, Slider, Tabs, TextArea, Toggle, Tooltip } from "@/components/gui";
import { iconUrl } from "@/lib/icons/keys";
import { RARITIES, RARITY_LABEL } from "@/lib/rarity";
import { RODS, TACKLE, rodByKey } from "@/lib/game/rods";
import { RodRadar, TackleRadar } from "@/components/economy/RodGear";
import { useSearch } from "@/lib/game/useMediaQuery";
import { ChevronLeft, CircleDot, Sparkles, UserRound, Waves, Worm } from "lucide-react";
import { CatchCard, CatchTag, LineGauge, PowerMeter, ReelPanel, ReelTags, ReelTrack, StatusChip } from "@/components/gui/flat/reel";
import { ActionBar, ActionIcon, Awakening, BarRows, CallTag, CardOverlay, CHART, ChartCard, Columns, DarkButton, Delta, FlatField, FlatSlider, FlatToggle, flyCoins, FlyHome, FlyIn, GearSlot, GhostButton, Heatmap, ItemCard, KeyBoard, KeyPeek, Keyword, KEYWORD_KINDS, KEYWORD_LIBRARY, KeywordLine, LevelUpMoment, PaperField, Phone, PrintedCard, ProgressCard, Purse, QuestCheck, RankBadge, RewardPop, RoundButton, Segmented, ServeMeter, SlotPop, SpinPicker, Spotlight, StaminaArc, StatTile, TimeChart, VitalBar, Vitals, WalletSlot, XpRing, type PeekKind, type PhoneApp } from "@/components/gui/flat";
import type { Rarity } from "@/lib/rarity";
import { BoardBody } from "@/components/game/volleyball/BoardSheet";
import { DEFAULT_LOOK } from "@/lib/game/character/look";
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
      <div data-testid="radar-live"><b>Glass rod, your build</b><RodRadar rod={rodByKey("rod_glass")!} tackle={on ? [bobber.key, bait.key] : []} />
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
      <ItemCard size="md" arrow={false} rarity="epic" awakened picture={iconUrl("rod_titanium_a1")} name="Awakened" line="Its mark, top right" />
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
    {/* FlyHome (round 9): the HUD isn't there before its key, then shows off above the card and flies to its place;
        here a stand-in clock, top right. */}
    {k >= 20 && <span data-demo-clock style={{ position: "absolute", top: 16, right: 16, padding: "6px 12px", borderRadius: 999, background: "var(--ui-card)", fontWeight: 800 }}>2:20 PM</span>}
    {k >= 20 && <FlyHome to={["[data-demo-clock]"]} from='[data-testid="lab-keys"]' />}
    <Spotlight light open label="Keys" testId="lab-keys" lead={hold ? <>Hold <Keycap>Tab</Keycap> Tools</> : <>Press <Keycap>I</Keycap> Bag</>}
      steps={{ count: 9, at: hold ? 0 : 4 }} footer={<GhostButton>Skip</GhostButton>}
      aside={hold ? k >= 4 && <TourPeek kind="wheel" out={k >= 18} /> : k >= 32 && <TourPeek kind="bag" out={k >= 39} />} asideAt={hold ? "top" : "right"}>
      <KeyBoard lit={hold ? "tab" : "i"} hold={hold} fill={hold ? Math.min(1, Math.max(0, (k - 4) / 12)) : 0} won={hold ? k >= 16 : k >= 34}
        done={hold ? [] : ["tab", "g", "h", "enter"]} down={new Set(hold ? (k >= 4 && k < 16 ? ["tab"] : []) : (k >= 32 && k < 34 ? ["i"] : []))} />
    </Spotlight>
  </>;
}
/** The phone (design bible UI, the phone): it pulls out bottom right and flips open, an app opens (the phone tucks down
 *  while it's open), the app closes and the phone comes back, then it's put away. */
function PhoneShow() {
  const [t, setT] = useState(0);
  useEffect(() => { const i = window.setInterval(() => setT(v => (v + 1) % 10), 700); return () => window.clearInterval(i); }, []);
  const apps: PhoneApp[] = [
    { id: "settings", label: "Settings", icon: "settings", onOpen: () => {} },
    { id: "quests", label: "Quests", icon: "quest", keyLabel: "J", onOpen: () => {} },
    { id: "bag", label: "Bag", icon: "bag", keyLabel: "I", onOpen: () => {} },
    { id: "collection", label: "Collection", icon: "collection", keyLabel: "B", onOpen: () => {} },
    { id: "friends", label: "Friends", icon: "friend", badge: 1, onOpen: () => {} },
    { id: "mail", label: "Mail", icon: "mail", keyLabel: "L", badge: 2, onOpen: () => {} },
  ];
  return <Phone open={t < 9} away={t >= 4 && t < 7} apps={apps} hint="X" onClose={() => {}} />;
}
/** Every peek (TourPeek in the kit's KeyPeek), one after another: each pops in, plays its loop, then fades as if the key
 *  were let go. The HUD and the minimap have none: the real pieces fly in from above the card (FlyHome, above). */
const PEEK_KINDS: PeekKind[] = ["wheel", "emote", "chat", "bag", "collection", "quests", "mail"];
function KeyPeekShow() {
  const [t, setT] = useState(0);
  useEffect(() => { const i = window.setInterval(() => setT(v => v + 1), 300); return () => window.clearInterval(i); }, []);
  const kind = PEEK_KINDS[Math.floor(t / 10) % PEEK_KINDS.length];
  return <div style={{ display: "grid", gridAutoFlow: "column", gap: 18, placeItems: "center", minHeight: "100%" }}>
    <TourPeek key={kind} kind={kind} out={t % 10 >= 9} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 184px)", gap: 12 }}>{PEEK_KINDS.map(k => <TourPeek key={k} kind={k} />)}</div>
  </div>;
}
/** The ID as the overlay: filled in on the card, printed out of the slot, stamped, then Done; hover it to tilt. */
function PrintedShow() {
  const [t, setT] = useState(0);
  useEffect(() => { const i = window.setInterval(() => setT(v => (v + 1) % 8), 1000); return () => window.clearInterval(i); }, []);
  const form = t < 3, printing = t >= 3 && t < 5, stamped = t >= 5;
  const rows: [string, ReactNode][] = form
    ? [["World name", <PaperField key="n" defaultValue="Marlowe" />], ["Pronouns", <PaperField key="p" placeholder="she/her, he/him, they/them" />], ["Birthday", <PaperField key="b" placeholder="March 14" />],
      ["About you", <PaperField key="a" placeholder="Say hi in a line" />]]
    : [["World name", "Marlowe"], ["Pronouns", "they/them"], ["Birthday", "March 14"], ["About you", "Here for the fishing"], ["Friend code", "K7QM-4R2X"]];
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
/** The whole icon library (design bible UI 8c: every talk line uses it), by tone: each kind's icon and the words that
 *  bring it up. */
const TONES = [["fish", "Sea creatures"], ["bug", "Land creatures"], ["coin", "Coins"], ["gem", "Gems, rewards, events"], ["item", "Things"], ["place", "Places"], ["person", "People"], ["act", "Things you do"]] as const;
function KeywordLibrary() {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px 22px", padding: 22, alignContent: "start", height: "100%", overflow: "auto" }}>
    {TONES.map(([tone, title]) => <section key={tone} style={{ display: "grid", gap: 5, alignContent: "start" }}>
      <h3 style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 900, color: "var(--ui-ink-2)" }}>{title}</h3>
      {KEYWORD_LIBRARY.filter(e => e.tone === tone).map(e => <div key={e.kind} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 15 }}>
        <Keyword kind={e.kind}>{e.words[0]}</Keyword>
        <span style={{ fontSize: 12, color: "var(--ui-muted)" }}>{e.words.slice(1).join(", ")}</span>
      </div>)}
    </section>)}
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

/** A sale: the fish's card in the middle, its coins flying to the purse, which ticks up, swells and glows as they land. */
function CoinFlyShow() {
  const card = useRef<HTMLDivElement>(null), count = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let n = 1240;
    const t = window.setTimeout(() => {
      const r = card.current?.querySelector("canvas")?.getBoundingClientRect();
      if (r) flyCoins({ from: r, amount: 196, onLand: share => { n += share; if (count.current) count.current.textContent = n.toLocaleString(); } });
    }, 400);
    return () => window.clearTimeout(t);
  }, []);
  return <>
    <span style={{ position: "absolute", top: 20, left: 24 }}><Purse coins={1240} gems={35} coinsRef={count} /></span>
    <div ref={card} style={{ position: "absolute", left: "50%", top: "50%", width: 168, transform: "translate(-50%, -50%)" }}>
      <ItemCard size="md" arrow={false} picture={iconUrl("fish_golden_trout")} rarity="epic" name="Golden Trout" line="Epic · River" price={{ amount: 196, currency: "coins" }} />
    </div>
  </>;
}

const OVERLAYS: { id: string; title: string; render: () => ReactNode }[] = [
  { id: "key-board", title: "Keys (a light Spotlight, KeyBoard, KeyPeek, SlotPop and FlyHome)", render: () => <KeyBoardShow /> },
  { id: "phone", title: "The phone (Phone): up, an app open (it tucks away), back", render: () => <PhoneShow /> },
  { id: "key-peek", title: "A key's peek (KeyPeek), every kind", render: () => <KeyPeekShow /> },
  { id: "wallet", title: "The wallet (WalletSlot), its slot under the time", render: () => <WalletShow /> },
  { id: "keyword", title: "Keywords in a line (Keyword)", render: () => <KeywordShow /> },
  { id: "keyword-library", title: "The icon library (every word Keyword knows)", render: () => <KeywordLibrary /> },
  { id: "fly-in", title: "Fly-in, into the wallet's slot", render: () => <Loop ms={3600}>{done => <><span style={{ position: "absolute", top: 16, right: 16 }}><WalletSlot coins={1240} gems={35} at="in" landing="coins" /></span>
    <FlyIn icon={<Coins size={52} />} name="Coins" text="For things on the island" to={['[data-hud-slot="coins"]']} onDone={done} /></>}</Loop> },
  { id: "coin-fly", title: "A sale's coins, into the purse (flyCoins)", render: () => <Loop ms={3400}>{() => <CoinFlyShow />}</Loop> },
  { id: "quest-check", title: "Quest complete", render: () => <Loop ms={3000}>{() => <QuestCheck eyebrow="Quest complete" title="Walk with Bram" />}</Loop> },
  { id: "printed-card", title: "Printed card as the overlay (CardOverlay, PrintedCard, PaperField)", render: () => <PrintedShow /> },
  { id: "awakening", title: "An awakening (Awakening): glow, pulse, hush, impact frames and burst, show, reveal", render: () => <Loop ms={12000}>{done => <Awakening label="Awakened" from="common" rarity="rare" rarityLabel="Rare rod"
    lead="Your Training rod is glowing…" eyebrow="Awakened!" name="Training rod" text="It fishes like a rare rod now." onClose={done}
    thing={after => <img src="/assets/icons/rod_training.webp" alt="" style={{ objectFit: "contain", imageRendering: "pixelated", filter: after ? "hue-rotate(160deg)" : undefined }} />}
    action={<DarkButton onClick={done}>Nice!</DarkButton>} />}</Loop> },
  { id: "oracle-reveal", title: "Oracle reveal card", render: () => <FamilyReveal family="Warden" type="INFP" onContinue={() => {}} /> },
  { id: "rune", title: "Rune overlay", render: () => <Loop ms={30000}>{done => <IncantationOverlay runeId="cross" title="Cross" effect="A warding cross" onDone={done} onCancel={done} />}</Loop> },
  { id: "emotes", title: "Emote wheel", render: () => <EmoteWheelShow /> },
  { id: "flat-rewards", title: "Flat reward pieces (hearts, reward track, prize wheel, goal meter, quiet toast)", render: () => <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: 24 }}><FlatRewards /><ToastHub /></div> },
  { id: "flat-pieces", title: "Flat pieces (tiles, hover card, day strip, odds, reveal, tasks, small panel, paper menu)", render: () => <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: 24 }}><FlatPieces /></div> },
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

/** One section of the kit. */
function Section({ id, title, note, children }: { id: string; title: string; note?: ReactNode; children: ReactNode }) {
  return <section id={id} className={s.section}>
    <header className={s.sectionHead}><h2>{title}</h2>{note && <p>{note}</p>}</header>
    <div className={s.sectionBody}><div className={s.ours}>{children}</div></div>
  </section>;
}
const Row = ({ label, children }: { label?: string; children: ReactNode }) => <div className={s.row}>{label && <span className={s.rowLabel}>{label}</span>}<div className={s.rowItems}>{children}</div></div>;

const SWATCHES: [string, string][] = [
  ["page", "Page"], ["paper", "Panel"], ["paper-hi", "Card"], ["paper-warm", "Card, dim"], ["paper-deep", "Well"], ["paper-edge", "Line"], ["paper-line", "Line, strong"],
  ["butter", "Selected"], ["highlight", "Highlight"], ["ink-strong", "Ink"], ["ink", "Ink, body"], ["ink-2", "Ink, soft"], ["muted", "Muted"], ["taupe", "Quiet"],
  ["sage", "Accent"], ["sage-deep", "Accent, deep"], ["sage-soft", "Pill"], ["teal", "Teal (no text)"], ["teal-ink", "Teal ink"], ["teal-pill", "Name pill"], ["coral", "Coral"], ["coral-ink", "Coral ink"], ["amber", "Amber"], ["orange", "Ribbon"], ["gold", "Gold"], ["grey", "Grey"],
  ["success", "Success"], ["warn", "Warn"], ["danger", "Danger"], ["info", "Info"], ["tethos-blue", "Tethos blue"], ["tethos-gold", "Tethos gold"],
];
const TYPE: [string, string][] = [["3xl", "36 · Island title"], ["2xl", "28 · Banner"], ["xl", "22 · Sheet title"], ["lg", "18 · Lead"], ["md", "15 · Body"], ["sm", "13 · Small"], ["xs", "12 · Tags (the floor)"]];

export default function GuiShowroom() {
  const search = useSearch();
  const only = search === null ? null : new URLSearchParams(search).get("only");
  const overlay = OVERLAYS.find(o => o.id === only);
  const [tab, setTab] = useState<"tools" | "outfits" | "furniture" | "specials">("tools");
  const [row, setRow] = useState(1);
  const [callRun, setCallRun] = useState(0);
  const [tile, setTile] = useState("fish_arowana");
  const [toggles, setToggles] = useState({ sound: true, hud: false });
  const [volume, setVolume] = useState(70);
  const [sheet, setSheet] = useState<null | "sm" | "md" | "lg">(only === "sheet" ? "md" : null);
  const [confirm, setConfirm] = useState(false);
  const [moment, setMoment] = useState(only === "moment");
  if (overlay) return <Stage tall>{overlay.render()}</Stage>;

  return <main className={`gui ${s.page}`}>
    <header className={s.top}>
      <h1>The flat kit</h1>
      <p>One look for the member game, the portal and the companion (design bible, UI; ledger row 334), in the base theme. Tokens in <code>styles/themes</code> (a UI pack swaps them whole) and <code>styles/game-tokens.css</code>, paper in <code>styles/paper.css</code>, pieces in <code>components/gui</code>.</p>
      <nav className={s.toc} aria-label="Sections">{["colour", "type", "paper", "buttons", "tabs", "lists", "tiles", "controls", "dialogue", "badges", "progress", "tooltips", "banners", "cards", "sheets", "states", "toasts", "rewards", "overlays", "fishing"].map(id => <a key={id} href={`#${id}`}>{id}</a>)}</nav>
    </header>

    <Section id="colour" title="Colour" note="The theme’s panel, cards and inks (the kit’s --gui-* names for the --ui-* tokens), and the fixed accents. Every text pair is AA (lib/gui/contrast.test.ts).">
      <div className={s.swatches}>{SWATCHES.map(([k, name]) => <figure key={k}><span style={{ background: `var(--gui-${k})` }} /><figcaption>{name}<small>--gui-{k}</small></figcaption></figure>)}</div>
    </Section>

    <Section id="type" title="Type" note="One rounded face (Nunito, self-hosted; the pack’s --ui-font); nothing under 12 px.">
      <div className={s.typeScale}>{TYPE.map(([k, label]) => <p key={k} style={{ fontSize: `var(--gui-text-${k})`, fontWeight: ["3xl", "2xl", "xl"].includes(k) ? 800 : 600 }}>{label}<small>--gui-text-{k}</small></p>)}</div>
    </Section>

    <Section id="paper" title="Radii, shadows and paper" note="The pack's shapes (--ui-r-*, --ui-shadow-*), and paper, the material, only for things that are paper in the world (data-gui-paper; styles/paper.css).">
      <Row label="Radii">{["sm", "md", "lg", "card", "paper", "blob", "tag"].map(r => <span key={r} className={s.radius} style={{ borderRadius: `var(--gui-r-${r})` }}>{r}</span>)}</Row>
      <Row label="Shadows">{["sm", "md", "lg"].map(h => <span key={h} className={s.radius} style={{ boxShadow: `var(--gui-shadow-${h})`, borderRadius: "var(--gui-r-card)" }}>{h}</span>)}</Row>
      <Row label="Paper"><Card pinned tilt={-0.8} data-gui-paper=""><b>A notice</b><p>Fishing derby, Saturday at the pier.</p></Card></Row>
    </Section>

    <Section id="buttons" title="Buttons and keycaps" note="Flat pills: the accent for the one action, white for the rest, the error ink for danger; keys on a small ink cap.">
      <Row label="Pills"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="quiet">Quiet</Button><Button variant="danger">Remove</Button><Button disabled>Disabled</Button></Row>
      <Row label="Small"><Button size="sm">Buy</Button><Button size="sm" variant="secondary" leadingKey="E">Talk</Button><Button size="sm" variant="quiet" leadingKey="B">Back</Button><Button size="sm" disabled>Sold out</Button></Row>
      <Row label="Focus"><span className={s.forceFocus}><Button size="sm">Focused</Button></span><span className={s.forceFocus}><IconButton label="Settings (focused)"><Settings size={18} aria-hidden /></IconButton></span></Row>
      <Row label="Icon buttons"><IconButton label="Mail" badge={2}><Mail size={18} aria-hidden /></IconButton><IconButton label="Sound"><Volume2 size={18} aria-hidden /></IconButton>
        <IconButton label="Settings"><Settings size={18} aria-hidden /></IconButton><IconButton label="Map" size="sm"><MapIcon size={16} aria-hidden /></IconButton>
        <IconButton label="Bag" size="lg" tone="butter"><Backpack size={24} aria-hidden /></IconButton><IconButton label="Go" tone="sage"><Sprout size={18} aria-hidden /></IconButton><IconButton label="Disabled" disabled><Coins size={18} aria-hidden /></IconButton></Row>
      <Row label="Keycaps"><Keycap>E</Keycap><Keycap>B</Keycap><Keycap>Tab</Keycap><Keycap>Space</Keycap><Keycap data-shape="square">[</Keycap><Keycap data-shape="square">]</Keycap></Row>
    </Section>

    <Section id="tabs" title="Tabs" note="Text tabs, the chosen one on the accent pill that slides to the next; arrows move, and in a dialog the menu’s [ and ] keys do too.">
      <Tabs label="Shop" value={tab} onChange={setTab} keyHints={["[", "]"]} tabs={[{ id: "tools", label: "Tools", icon: <img src={iconUrl("rod_cedar")} alt="" /> },
        { id: "outfits", label: "Outfits", icon: <img src={iconUrl("top_cardigan")} alt="" /> }, { id: "furniture", label: "Furniture", icon: <img src={iconUrl("lounge-sofa")} alt="" /> }, { id: "specials", label: "Today’s specials", badge: 3 }]} />
      <Row label="Plain"><Tabs label="Journal" value="quests" onChange={() => {}} tabs={[{ id: "quests", label: "Quests" }, { id: "chapters", label: "Chapters" }, { id: "museum", label: "Museum", disabled: true }]} /></Row>
    </Section>

    <Section id="lists" title="List rows" note="Rules between rows, a leader to the value, the chosen row on the selection colour with the pointing hand.">
      <List label="Shop">
        <ListRow icon={iconUrl("acc_cap")} title="Cap" detail="Accessory" leader value={<Amount n={350} />} onClick={() => setRow(0)} selected={row === 0} />
        <ListRow icon={iconUrl("acc_backpack")} title="Backpack" detail="Accessory" leader value={<Amount n={1200} />} onClick={() => setRow(1)} selected={row === 1} />
        <ListRow icon={iconUrl("lounge-tea")} title="Tea set" detail="Furniture" leader value={<Amount n={220} />} onClick={() => setRow(2)} selected={row === 2} />
        <ListRow icon={iconUrl("rod_glass")} title="Glass rod" detail="Premium · needs level 8" value="Locked" onClick={() => {}} disabled />
        <ListRow icon={iconUrl("rock_stone")} title="Stone" leader value={<><b>2</b> / 5</>} />
      </List>
    </Section>

    <Section id="tiles" title="Item tiles" note="The real item icons on a white card, a rarity edge, the stack count; a dot while new, a silhouette until found, a little dot for a free slot.">
      <div className={s.tiles}>
        {(["fish_dace", "fruit_pear", "fish_arowana", "bug_emperor_butterfly", "fish_coelacanth", "fish_golden_koi", "fish_barreleye"] as const).map((k, i) => <ItemTile key={k} icon={iconUrl(k)} name={k.replace(/^[a-z]+_/, "").replace(/_/g, " ")}
          rarity={RARITIES[i]} count={[1, 12, 2, 1, 1, 1, 1][i]} isNew={i === 4} selected={tile === k} onClick={() => setTile(k)} caption={RARITY_LABEL[RARITIES[i]]} />)}
        <ItemTile icon={iconUrl("fish_oarfish")} name="Oarfish" unknown caption="Not found" />
        <ItemTile name="" empty caption="Free slot" />
        <ItemTile icon={iconUrl("shovel-gold")} name="Golden shovel" size={56} caption="Small" />
      </div>
    </Section>

    <Section id="controls" title="Toggles, sliders and fields" note="Settings rows: a switch, a slider with its value, a select, and the kit’s fields on a grey well.">
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

    <Section id="dialogue" title="Dialogue" note="Someone talking: a white card, their name on a tag at the top, the way on under the words.">
      <Dialogue speaker="Alice · HQ lead" onContinue={() => {}} continueLabel="Next"><p>Welcome to Tethos Island, <strong>Juniper</strong>! Your plot is waiting past the café.</p></Dialogue>
      <Row label="Name tags"><NameTag>Alice</NameTag><NameTag tone="sage">Rosa · Café</NameTag><NameTag tone="paper">Sable</NameTag></Row>
    </Section>

    <Section id="radar" title="Rod radar (flat kit)" note="lib/game/rods.ts: six stats out of 100, a light hex with an icon at each corner (hover for what it does). Your build in the chart colour with the rod alone faint behind; an add-on slides it linearly. The gear slots sit in your rod's stage corner; rarity is a thin outline.">
      <RodGearShow />
    </Section>

    <Section id="badges" title="Badges and counters" note="Status tags and the red count on a shoulder (nothing at zero).">
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

    <Section id="flat-fields" title="Fields and buttons (flat)" note="The title's sign-in: grey-well fields (the label is the placeholder, read aloud), the dark pill for the one action, the white pill beside it, the round back, the switch and the slider (the title’s Settings).">
      <Row><div style={{ display: "grid", gap: 10, width: 280 }}>
        <RoundButton label="Back"><ChevronLeft size={18} /></RoundButton>
        <FlatField label="Email" type="email" />
        <FlatField label="Password" type="password" defaultValue="hunter22" />
        <DarkButton>Sign in</DarkButton>
        <GhostButton>Not now</GhostButton>
        <FlatToggle checked onChange={() => {}} hint="The island's crisp pixel look">Pixel finish</FlatToggle>
        <FlatToggle checked={false} onChange={() => {}}>Sun shadows</FlatToggle>
        <FlatSlider label="Volume" value={70} onChange={() => {}} format={v => `${v}%`} />
      </div></Row>
    </Section>

    <Section id="serve-meter" title="Serve meter (flat)" note="The volleyball serve’s power: a triangle wide at the top, the fill warming from sea to coral to gold; it leans in and trembles as it fills, and flashes Max at the top.">
      <Row><ServeMeter value={0.3} label="Serve power"><Keycap>Hold</Keycap></ServeMeter><ServeMeter value={0.72} label="Serve power" /><ServeMeter value={0.97} label="Serve power, max" /></Row>
    </Section>

    <Section id="call-tag" title="Call tag (flat)" note="A call at a moment of play, small and quiet: a white chip with a coloured cap holding the call’s picture. Gold for Perfect and Max, the team’s colour for Saved and Block, grey for Early, Late and Miss. Played: in with a spring (a block slams down), a held beat, up and out.">
      <Row label="Calls">
        {([["perfect", "Perfect"], ["good", "Good"], ["soft", "Early"], ["soft", "Late"], ["saved", "Saved"], ["block", "Block"], ["whiff", "Miss"], ["max", "Max"]] as const).map(([kind, word]) =>
          <CallTag key={word} kind={kind} team={kind === "block" ? "var(--ui-away)" : "var(--ui-home)"}>{word}</CallTag>)}
      </Row>
      <Row label="Played"><span key={callRun} style={{ display: "inline-grid", gap: 8 }}>
        <CallTag kind="perfect" live>Perfect</CallTag><CallTag kind="block" team="var(--ui-away)" live>Block</CallTag></span>
        <GhostButton onClick={() => setCallRun(n => n + 1)}>Play again</GhostButton></Row>
    </Section>

    <Section id="action-bar" title="Action bar (flat)" note="A match’s moves: each a pictogram, its key and its name. A slot that would connect glows; a press flashes it. The ground’s and the air’s rows swap in place.">
      <Row><ActionBar active="ground" flash={{ id: "set", n: 1, ok: true }} rows={{ ground: ["bump", "set", "dive"].map((a, i) => ({ id: a, label: ["Bump", "Set", "Dive"][i], keycap: ["Left click", "E", "Q"][i], mouse: i === 0 ? "left" as const : undefined, icon: <ActionIcon move={a} />, ready: a === "bump" })) }} /></Row>
      <Row><ActionBar active="air" rows={{ air: ["spike", "jumpset", "block"].map((a, i) => ({ id: a, label: ["Spike", "Jump set", "Block"][i], keycap: ["Left click", "E", "Right click"][i], mouse: i === 1 ? undefined : i === 0 ? "left" as const : "right" as const, icon: <ActionIcon move={a} />, ready: a === "spike" })) }} /></Row>
      <Row>{["serve", "charge", "spin"].map(a => <ActionIcon key={a} move={a} size={40} />)}</Row>
    </Section>

    <Section id="spin-picker" title="Spin picker (flat)" note="Where on the ball the serve is hit: off centre to a side curves it, the top dives, the bottom floats.">
      <Row><SpinPicker x={0} y={0} picture="/assets/game/volleyball/ball-icon.png" label="Centre" /><SpinPicker x={0.6} y={0.4} picture="/assets/game/volleyball/ball-icon.png" label="Top right"><Keycap>R-click</Keycap></SpinPicker></Row>
    </Section>

    <Section id="rank" title="Rank badge, podium and the leaderboard (flat)" note="A place in a ranking, the first in gold; the podium (three white blocks in one stepped stand, the first in the middle and tallest, big gold, silver and bronze numbers and thin edges of them, the names in a row under it, the top three dancing on their blocks on one beat); the volleyball court’s board: the podium, a few rows under it, your place, and a Sample tag until phase 3.">
      <Row><RankBadge rank={1} /><RankBadge rank={2} /><RankBadge rank={10} /></Row>
      <BoardBody mine={DEFAULT_LOOK} board={{ sample: true, rows: [["Kelpie", 14], ["Sandpiper", 11], ["Driftwood", 9], ["Pebble", 7], ["Tidepool", 5], ["Coralie", 4], ["Gull", 2], ["Islander", 1]].map(([name, wins], i) => ({ rank: i + 1, name: name as string, wins: wins as number, you: name === "Islander" })) }} />
    </Section>

    <Section id="tooltips" title="Tooltips" note="A name pill with a tail, on hover and on keyboard focus.">
      <Row><Tooltip label="Open your mail (L)"><IconButton label="Mail"><Mail size={18} aria-hidden /></IconButton></Tooltip>
        <span className={s.tipShown}><Tooltip label="Cedar rod · Mid tier"><IconButton label="Rod"><Fish size={18} aria-hidden /></IconButton></Tooltip></span>
        <span className={s.tipShown}><Tooltip label="Below, too" place="bottom"><Button size="sm" variant="quiet">Hover me</Button></Tooltip></span></Row>
    </Section>

    <Section id="banners" title="Banners" note="A flat tinted band; a tag at its end for deadlines.">
      <Banner title="Today’s specials" ribbon="Until 11:59 PM" icon={<ShoppingBasket size={26} />}>Three things the shopkeeper set aside for you.</Banner>
      <Banner title="Chapter 1: Settle in" tone="sage" icon={<BookOpen size={26} />}>Claim your plot, catch something, report to HQ.</Banner>
      <Banner title="GENESIS week" tone="coral" ribbon="3 days left">The posters are up by the café.</Banner>
    </Section>

    <Section id="cards" title="Panels and cards" note="White cards, tinted ones; pinned notices are paper (data-gui-paper), with their pin and a little tilt.">
      <div className={s.cards}>
        <Card><b>Card</b><p>A white card on the panel.</p></Card>
        <Card tone="butter"><b>Selected</b><p>A highlighted choice.</p></Card>
        <Card tone="sage"><b>Pill</b><p>Something done.</p></Card>
        <Card pinned tilt={-1.2} data-gui-paper=""><b>Pinned notice</b><p>Help reopen the café: 40 wood.</p></Card>
      </div>
    </Section>

    <Section id="sheets" title="Sheets and confirm dialogs" note="The one dialog frame: one flat light panel, the title and a round close, Escape and the opening key close it, focus stays inside, a soft paper sound, a scale-and-fade in and out; a bottom sheet on a phone.">
      <Row><Button size="sm" onClick={() => setSheet("sm")}>Small sheet</Button><Button size="sm" onClick={() => setSheet("md")}>Sheet</Button><Button size="sm" onClick={() => setSheet("lg")}>Wide sheet</Button>
        <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>Confirm dialog</Button></Row>
    </Section>

    <Section id="states" title="Loading, empty and error" note="Waiting says what for; empty says what’s missing and what to do; errors say what happened, never “empty”.">
      <div className={s.cards}>
        <Card><Loading label="Laying out your recipes…" /></Card>
        <Card><Empty icon={<PackageOpen size={34} />} title="Nothing in your bag yet" action={<Button size="sm" variant="quiet">Go fishing</Button>}>Catches, fruit and finds land here.</Empty></Card>
        <Card><Empty icon={<img src={iconUrl("yellow-message-mat")} alt="" />} title="No letters">When someone writes, it arrives here.</Empty></Card>
        <Card><ErrorNote onRetry={() => {}}>Your mail didn’t load. The connection dropped.</ErrorNote></Card>
      </div>
    </Section>

    <Section id="charts" title="Charts (flat kit)" note="components/gui/flat/charts.tsx, for the admin analytics page: a headline tile with its change, days over time (bars and lines, hover for the read-out), bars along rows with a drop line, a distribution, a heatmap. One hue per job from the theme, values in ink.">
      <div style={{ display: "grid", gap: 12, padding: 16, borderRadius: 22, background: "var(--ui-panel)" }}>
        <Segmented label="Range" value={30} onChange={() => {}} options={[{ id: 7, label: "7 days" }, { id: 30, label: "30 days" }, { id: 90, label: "90 days" }]} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, padding: 16, borderRadius: 16, background: "var(--ui-card)" }}>
          <StatTile label="Players a day" value="14.2" sub={<Delta now={14.2} before={11} />} />
          <StatTile label="Next-day return" value="38%" sub={<Delta now={38} before={44} unit="pct" />} />
          <StatTile label="Stickiness" value="21%" sub="a day over the month" />
        </div>
        <ChartCard title="Players over time" note="Hover a day.">
          <TimeChart label="Players a day" labels={["Nov 1", "Nov 2", "Nov 3", "Nov 4", "Nov 5", "Nov 6", "Nov 7"]} series={[
            { label: "Played that day", kind: "bar", color: CHART.soft, values: [8, 11, 9, 14, 12, 16, 13] },
            { label: "Played that week", kind: "line", color: CHART.a, values: [20, 22, 23, 25, 26, 28, 29] },
            { label: "New", kind: "line", color: CHART.b, values: [3, 4, 2, 6, 3, 5, 4] },
          ]} />
        </ChartCard>
        <ChartCard title="Bars along rows">
          <BarRows rows={[
            { key: "a", label: "Signed in", value: 100, text: "40" },
            { key: "b", label: "Character made", value: 80, text: "32", drop: { text: "8 stopped here (20%)", big: true } },
            { key: "c", label: "Fishing", value: 60, inner: 35, text: "24" },
          ]} max={100} />
        </ChartCard>
        <ChartCard title="A distribution"><Columns label="Session length" bins={[{ label: "Under 1", n: 3 }, { label: "1 to 5", n: 12 }, { label: "5 to 15", n: 20 }, { label: "15 to 30", n: 9 }, { label: "30+", n: 4 }]} /></ChartCard>
        <ChartCard title="A heatmap"><Heatmap lead={["Week of", "Joined"]} cols={["Day 1", "Day 7", "Day 30"]} rows={[
          { label: "Oct 26", side: 12, cells: [58, 25, null] }, { label: "Oct 19", side: 9, cells: [44, 22, 11] },
        ]} /></ChartCard>
      </div>
    </Section>

    <Section id="toasts" title="Toasts" note="The island’s toast lane, with the real item icon.">
      <Row><Button size="sm" onClick={() => toast("You caught a dace! 14 cm.", iconUrl("fish_dace"))}>Catch toast</Button>
        <Button size="sm" variant="quiet" onClick={() => toast("A new room is ready. 1,240 TC left.", iconUrl("home-bed"))}>Room toast</Button>
        <Button size="sm" variant="quiet" onClick={() => toast("Your backpack is full.")}>Plain toast</Button></Row>
      <div className={s.toastStage}><ToastHub /></div>
    </Section>

    <Section id="hud-bars" title="The vitals, the level ring and the stamina arc (flat kit)" note="specs/design-bible.md UI 8: the level in a ring of XP (hover for the exact XP) with health, sliding from its full colour through amber to its low colour as it empties, a notch every 20 points, critical flashing; the Capsule look (David 11-05). A class's shield extends the health bar in its own colour; its mana is a slimmer bar under it. Stamina is a ) beside the character, only at a quarter or under. components/gui/flat/vitals.tsx; the island's are components/game/HudBars.tsx.">
      <Row>
        {([[1, "100"], [0.5, "50"], [0.15, "15"]] as const).map(([h, n]) =>
          <Vitals key={n} ring={<XpRing level={3} fill={0.42} into={126} needed={300} />}><VitalBar kind="health" value={h} critical={h < 0.25} label={`Health ${n} of 100`} /></Vitals>)}
      </Row>
      <Row>
        {([[1, 1], [0.8, 0.5], [0.15, 0.2]] as const).map(([h, sh]) =>
          <Vitals key={h} ring={<XpRing level={3} fill={0.42} into={126} needed={300} />}><VitalBar kind="health" value={h} critical={h < 0.25} shield={{ value: sh, max: 40 }} label={`Health ${h * 100} of 100, shield ${sh * 40} of 40`} /></Vitals>)}
        <Vitals ring={<XpRing level={3} fill={0.42} into={126} needed={300} />}><VitalBar kind="health" value={0.8} label="Health 80 of 100" /><VitalBar kind="mana" value={0.35} label="Mana 35 of 100" /></Vitals>
      </Row>
      <Row>{[1, 0.5, 0].map(st => <div key={st} style={{ position: "relative", width: 60, height: 120 }}>
        <StaminaArc ref={el => { el?.toggleAttribute("data-show", true); el?.style.setProperty("--vital", String(st)); el?.style.setProperty("--x", "0.2"); }} /></div>)}</Row>
    </Section>

    <Section id="rewards" title="Rewards and moments (flat kit)" note="specs/design-bible.md UI 4 and 7: a reward pops with its rarity as the outline (divine: the holo); a level up is the big moment (motes into the figure, a flash per mote, the burst, then what it unlocks). components/gui/flat RewardPop and LevelUpMoment.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
        {POPS.map(([rarity, key, name, title, facts]) => <RewardPop key={rarity ?? key} picture={iconUrl(key)} title={title} name={name} rarity={rarity}
          rarityLabel={rarity ? rarity[0].toUpperCase() + rarity.slice(1) : null} facts={facts ? <span>{facts}</span> : null} isNew={rarity === "rare"} note="The one-liner, quiet." testId={`pop-${rarity ?? key}`} />)}
      </div>
      <Row><Button size="sm" onClick={() => setMoment(true)}>Show the level up</Button></Row>
      {moment && <LevelUpMoment level={2} title="You're level 2" onClose={() => setMoment(false)} testId="showroom-moment"
        figure={<UserRound size={200} strokeWidth={1.25} style={{ display: "block", margin: "60px auto 0", color: "var(--ui-ink-2)" }} />}
        items={[{ key: "quest", icon: <BookOpen size={28} />, motion: "flip", title: "New quest: Odile's net", line: "Odile at the museum has a spare net." },
          { key: "points", icon: <Sparkles size={28} />, motion: "twinkle", title: "3 stat points", line: "Spend them on your path (P)." }]} />}
    </Section>

    <section id="overlays" className={s.section}>
      <header className={s.sectionHead}><h2>The game’s overlays</h2><p>The same components the island mounts, over a stand-in world.</p></header>
      {/* They are dialogs that re-open on a loop, so they step aside while a demo sheet is up (each re-open would take
          the top of the dialog stack, and Escape with it). */}
      {sheet === null && !confirm && OVERLAYS.map(o => <div key={o.id} className={s.overlay}><h3>{o.title}</h3><Stage>{o.render()}</Stage></div>)}
    </section>

    <Sheet open={sheet !== null} onClose={() => setSheet(null)} title="Settings" eyebrow={sheet === "lg" ? "HQ" : undefined}
      size={sheet === "sm" ? "sm" : sheet === "lg" ? "lg" : "md"}
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
