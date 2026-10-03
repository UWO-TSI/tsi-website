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
import { EmoteMenuView } from "@/components/game/EmoteMenu";
import ToastHub, { toast } from "@/components/game/ToastHub";
import { Amount } from "@/components/economy/Amount";
import { Badge, Banner, Button, Card, ConfirmDialog, Counter, Dialogue, Empty, ErrorNote, Field, IconButton, ItemTile, Keycap, List, ListRow, Loading, NameTag, Panel, Progress, Select,
  Sheet, Slider, Tabs, TextArea, Toggle, Tooltip } from "@/components/gui";
import { FISH } from "@/lib/game/fishing";
import { iconUrl } from "@/lib/icons/keys";
import type { EmoteType } from "@/lib/content/types";
import { useSearch } from "@/lib/game/useMediaQuery";
import s from "./showroom.module.css";

const EMOTES: EmoteType[] = ["wave", "dance", "laugh", "point", "sit"].map(slug => ({
  id: slug, slug, display_name: slug[0].toUpperCase() + slug.slice(1), animation_key: slug, icon_url: null, unlock_condition: null, active: true, created_at: "",
}));

/** Re-mounts its child every `ms` (an overlay that finishes and closes itself stays on show). */
function Loop({ ms, children }: { ms: number; children: (done: () => void) => ReactNode }) {
  const [n, setN] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setN(v => v + 1), ms); return () => window.clearInterval(t); }, [ms]);
  return <div key={n} style={{ display: "contents" }}>{children(() => {})}</div>;
}

const OVERLAYS: { id: string; title: string; render: () => ReactNode }[] = [
  { id: "fish-reveal", title: "Fish reveal", render: () => <Loop ms={9000}>{done => <FishReveal fish={FISH.find(f => f.rarity === "rare") ?? FISH[0]} sizeCm={42} onDone={done} />}</Loop> },
  { id: "oracle-reveal", title: "Oracle reveal card", render: () => <FamilyReveal family="Warden" type="INFP" onContinue={() => {}} /> },
  { id: "rune", title: "Rune overlay", render: () => <Loop ms={30000}>{done => <IncantationOverlay runeId="cross" title="Cross" effect="A warding cross" onDone={done} onCancel={done} />}</Loop> },
  { id: "emotes", title: "Emote menu", render: () => <EmoteMenuView open emotes={EMOTES} onClose={() => {}} onPick={() => {}} /> },
];

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
  if (overlay) return <Stage tall>{overlay.render()}</Stage>;

  return <main className={`gui ${s.page}`}>
    <header className={s.top}>
      <h1>Our GUI sheet</h1>
      <p>The member game, portal and companion, drawn from David’s Animal Crossing UI kit: warm paper, sage, wood and Tethos accents. Tokens in <code>styles/game-tokens.css</code>, pieces in <code>components/gui</code>.</p>
      <nav className={s.toc} aria-label="Sections">{["colour", "type", "paper", "buttons", "tabs", "lists", "tiles", "controls", "dialogue", "badges", "progress", "tooltips", "banners", "cards", "sheets", "states", "toasts", "overlays"].map(id => <a key={id} href={`#${id}`}>{id}</a>)}</nav>
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
        {(["fish_dace", "fruit_pear", "fish_arowana", "bug_emperor_butterfly", "fish_coelacanth"] as const).map((k, i) => <ItemTile key={k} icon={iconUrl(k)} name={k.replace(/^[a-z]+_/, "").replace(/_/g, " ")}
          rarity={(["common", "uncommon", "rare", "epic", "legendary"] as const)[i]} count={[1, 12, 2, 1, 1][i]} isNew={i === 4} selected={tile === k} onClick={() => setTile(k)} caption={(["Common", "Uncommon", "Rare", "Epic", "Legendary"])[i]} />)}
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
      <Dialogue speaker="Wren · HQ lead" onContinue={() => {}} continueLabel="Next"><p>Welcome to Tethos Island, <strong>Juniper</strong>! Your plot is waiting past the café.</p></Dialogue>
      <Row label="Name tags"><NameTag>Wren</NameTag><NameTag tone="sage">Rosa · Café</NameTag><NameTag tone="paper">Sable</NameTag></Row>
    </Section>

    <Section id="badges" title="Badges and counters" kit={["recipe", "phone"]} note="Status tags and the red count on a shoulder (nothing at zero).">
      <Row label="Badges"><Badge>Basic</Badge><Badge tone="sage">Owned</Badge><Badge tone="success">Done</Badge><Badge tone="warn">Ready</Badge><Badge tone="danger">Sold out</Badge><Badge tone="info">Event</Badge><Badge tone="gold">Daily selection</Badge><Badge tone="new">New!</Badge></Row>
      <Row label="Counters"><Counter n={1} /><Counter n={4} /><Counter n={12} /><span className={s.note}>(0 shows nothing)</span><Counter n={0} /></Row>
      <Row label="Amounts"><Amount n={1240} /><Amount n={750} currency="gems" /></Row>
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

    <section id="overlays" className={s.section}>
      <header className={s.sectionHead}><h2>The game’s overlays</h2><p>The same components the island mounts, over a stand-in world.</p></header>
      {OVERLAYS.map(o => <div key={o.id} className={s.overlay}><h3>{o.title}</h3><Stage>{o.render()}</Stage></div>)}
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
