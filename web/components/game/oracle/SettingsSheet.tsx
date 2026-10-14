"use client";

/**
 * Settings sheet (row 220) over the account settings (lib/identity/settings):
 * text size, high contrast, and menu key remap; the island's look and
 * performance (pixel finish, quality, shadows) are this device's
 * (useGraphicsSettings, hud-first-login §4). Remap listens for the next
 * key; taking another menu's key swaps the two; reserved keys are refused
 * with the systems rule's reason. Saved to the account when signed in,
 * otherwise kept on this device. The movement keys (walking, jump, dash,
 * sprint, crouch/slide) and the ruins' ability keys are remapped on this device.
 * Outside macOS, Ctrl crouches only in fullscreen with the keyboard locked.
 *
 * The controls list lives only here (specs/v1-drop.md §1.5: no movement UI on the island): every remappable key, then
 * the fixed ones (the emote wheel is with the movement keys). The dash and the glider say they wait for a Keeper until one teaches them (lib/game/moveUnlocks.ts).
 *
 * Playtest round 1 (decision 3): the one Settings, the gear and the wrench merged, opened from the UI view's gear (Esc 1)
 * or the system menu (Esc 2). On the island it has tabs: Graphics, Sound, Controls, Account (Log out) and, in
 * development builds only, Dev (`dev`: the old wrench panel). Quality is the kit's segmented pills, not a dropdown.
 * The phone companion keeps one page: text size, contrast and sound.
 */
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import type { QualityTier } from "@/lib/game/qualityTier";
import { ACTION_LABEL, MENU_ACTIONS, REMAPPABLE_ACTIONS, TEXT_SIZES, normalizeKey, type MenuAction, type TextSize } from "@/lib/identity/settings";
import { Button, SignInText, Slider, Tabs, Toggle } from "@/components/gui";
import { saveSettings, setAuraVisible, useWorldIdentity } from "@/lib/game/identity";
import { DROPS } from "@/lib/game/drops";
import { ABILITIES, type AbilityId } from "@/lib/game/combat/runtime";
import { IS_MAC, MOVE_ACTIONS, abilityPreset, canLockKeyboard, crouchKey, keyName, playFullscreenWithCtrl, presetAbilities, remapAbility, remapMove, remapWheel, useAbilityKeys, useKeyboardLocked, useMoveKeys, useNextKey, useWheelKeys, type MoveAction } from "@/lib/game/movement/keys";
import { AudioManager, type AudioVolumes } from "@/lib/game/audio";
import { useAudioState } from "@/lib/game/useAudio";
import { orbit, readOrbitPrefs, setOrbitPrefs, subscribeOrbitPrefs, SENSITIVITY_MAX, SENSITIVITY_MIN } from "@/lib/game/orbitCamera";
import { setAlwaysFullHud, setShowClass, useAlwaysFullHud, useShowClass } from "@/lib/game/hudPrefs";
import { setComfort, useComfort, type ShakeLevel } from "@/lib/game/comfortSettings";
import { setFishingFlag, useFishingLine, useHoldUpCatch } from "@/lib/game/fishingPrefs";
import { useMoveUnlocks } from "@/lib/game/moveUnlocks";
import { RESET_VIEW_KEY } from "../useOrbitInput";
import IslandSheet from "../IslandSheet";
import { logOut } from "../EscLayers";
import styles from "../DefaultIslandWorld.module.css";

const SIZE_NAMES: Record<TextSize, string> = { small: "Small", default: "Standard", large: "Large", xl: "Largest" };
/** The movement keys (specs/movement.md): WASD, Space jump, Q dash, Shift sprint, crouch/slide (Ctrl on macOS, C elsewhere). */
const MOVE_ROW = MOVE_ACTIONS;
/** The fixed controls (lib/identity/settings FIXED_KEYS and the mouse), listed so the island needs no key bar. */
const FIXED_CONTROLS: { label: string; keys: string[] }[] = [
  { label: "Interact, talk, pick up", keys: ["E"] },
  { label: "Use what you hold, or click who's under the dot", keys: ["Click"] },
  { label: "Look around", keys: ["Mouse", "←", "→"] },
  { label: "A free cursor (hold)", keys: ["Right click"] },
  { label: "Menu, then the system menu", keys: ["Esc"] },
  { label: "Chat", keys: ["Enter"] },
  { label: "Photo mode", keys: ["P"] },
  { label: "Reset the view", keys: [RESET_VIEW_KEY.toUpperCase()] },
  { label: "Zoom", keys: ["Z", "Wheel"] },
  { label: "Journal", keys: ["J"] },
  { label: "Decorate (at home)", keys: ["F"] },
];
const SOUND_SLIDERS: { key: keyof AudioVolumes; label: string }[] = [
  { key: "master", label: "Master" },
  { key: "music", label: "Music" },
  { key: "ambient", label: "Ambience" },
  { key: "sfx", label: "Sound effects" },
];

type Tab = "graphics" | "sound" | "controls" | "account" | "dev";

export default function SettingsSheet({ open, onClose, detectedTier = null, place = "island", dev }: { open: boolean; onClose: () => void; detectedTier?: QualityTier | null;
  /** The phone companion (reachability §4): what a phone can use, text size, contrast and sound; no graphics, camera or keys. */
  place?: "island" | "phone";
  /** Development builds: the island's dev tools (camera view, time, return to the clearing, frame timing), in a Dev tab. */
  dev?: ReactNode }) {
  const island = place === "island";
  const [tab, setTab] = useState<Tab>("graphics");
  const { settings, signedIn, aura, display_name: worldName } = useWorldIdentity();
  const [leaving, setLeaving] = useState(false);
  const [graphics, graphicsActions] = useGraphicsSettings();
  // isExplicit isn't part of the store snapshot: re-render on a change so Auto shows as chosen.
  const [, rerender] = useState(0);
  const quality = graphicsActions.isExplicit("liteMode") ? (graphics.liteMode ? "light" : "high") : "auto";
  const setQuality = (value: string) => {
    rerender(n => n + 1);
    if (value === "auto") graphicsActions.unset("liteMode");
    else { graphicsActions.setLiteMode(value === "light"); if (value === "high") graphicsActions.setShadows(true); }
  };
  const audio = useAudioState();
  const camera = useSyncExternalStore(subscribeOrbitPrefs, readOrbitPrefs, () => orbit.prefs);
  const [listening, setListening] = useState<MenuAction | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const abilityKeys = useAbilityKeys();
  const [abilityListen, setAbilityListen] = useState<AbilityId | null>(null);
  const [abilityNote, setAbilityNote] = useState<string | null>(null);
  const moveKeys = useMoveKeys(), keyLock = useKeyboardLocked(), unlocks = useMoveUnlocks();
  const [moveListen, setMoveListen] = useState<MoveAction | null>(null);
  const [moveNote, setMoveNote] = useState<string | null>(null);
  const wheelKeys = useWheelKeys();
  const alwaysFullHud = useAlwaysFullHud();
  const comfort = useComfort(), showClass = useShowClass();
  const fishingLine = useFishingLine(), holdUpCatch = useHoldUpCatch();
  const [wheelListen, setWheelListen] = useState<"wheel" | "hud" | "emote" | null>(null);
  useNextKey(wheelListen !== null, key => {
    const r = remapWheel(wheelKeys, wheelListen!, key);
    setMoveNote(r.ok ? null : r.error);
    if (r.ok) setWheelListen(null);
  }, () => { setWheelListen(null); setMoveNote(null); });
  useNextKey(moveListen !== null, key => {
    const r = remapMove(moveKeys, moveListen!, key);
    setMoveNote(r.ok ? null : r.error);
    if (r.ok) setMoveListen(null);
  }, () => { setMoveListen(null); setMoveNote(null); });
  useNextKey(abilityListen !== null, key => {
    const r = remapAbility(abilityKeys, abilityListen!, key);
    setAbilityNote(r.ok ? null : r.error);
    if (r.ok) setAbilityListen(null);
  }, () => { setAbilityListen(null); setAbilityNote(null); });
  const save = async (patch: Parameters<typeof saveSettings>[0], ok?: string) => {
    const error = await saveSettings(patch);
    setNote(error ?? ok ?? null);
  };
  useNextKey(listening !== null, raw => {
    const key = normalizeKey(raw), action = listening!;
    if ([...Object.values(moveKeys), ...Object.values(abilityKeys)].includes(key)) { setNote(`${keyName(key)} is already used.`); return; }
    const other = MENU_ACTIONS.find(a => a !== action && settings.key_bindings[a] === key);
    const patch = { ...settings.key_bindings, [action]: key, ...(other ? { [other]: settings.key_bindings[action] } : {}) };
    void saveSettings({ key_bindings: patch }).then(error => {
      if (error) { setNote(error); return; }
      setListening(null);
      setNote(`${ACTION_LABEL[action]} is now ${keyName(key)}.${other ? ` ${ACTION_LABEL[other]} moved to ${keyName(settings.key_bindings[action])}.` : ""}`);
    });
  }, () => { setListening(null); setNote(null); });
  const shows = (t: Tab) => !island || tab === t;
  const textSize = <fieldset>
      <legend>Text size</legend>
      <div className={styles.segmented}>{TEXT_SIZES.map(s => <button key={s} aria-pressed={settings.text_size === s} onClick={() => void save({ text_size: s })}>{SIZE_NAMES[s]}</button>)}</div>
    </fieldset>;
  const accessibility = <fieldset data-testid="accessibility">
      <legend>Accessibility</legend>
      <Toggle checked={settings.high_contrast} onChange={on => void save({ high_contrast: on })}>High contrast</Toggle>
      {island && <>
      <Toggle checked={comfort.reduceFlashing} onChange={on => setComfort({ reduceFlashing: on })} hint="Big hits darken the screen instead of flashing it, and their lines and glows are softer.">Reduce flashing</Toggle>
      <div className={styles.preset}>
        <span>Screen shake</span>
        <div className={styles.segmented} role="group" aria-label="Screen shake">
          {(["full", "low", "off"] as ShakeLevel[]).map(l => <button key={l} aria-pressed={comfort.screenShake === l} onClick={() => setComfort({ screenShake: l })}>{l === "full" ? "Full" : l === "low" ? "Low" : "Off"}</button>)}
        </div>
      </div>
      <p className={styles.hint}>Kept on this device.</p>
      </>}
    </fieldset>;
  const sound = <fieldset>
      <legend>Sound</legend>
      {!audio.enabled && <Button size="sm" variant="secondary" onClick={() => AudioManager.enable()}>Turn on sound</Button>}
      <Toggle checked={audio.muted} onChange={on => AudioManager.setMuted(on)}>Mute</Toggle>
      {SOUND_SLIDERS.map(({ key, label }) => (
        <Slider key={key} label={label} min={0} max={100} value={Math.round(audio.volumes[key] * 100)} format={v => `${v}%`}
          onChange={v => AudioManager.setVolumes({ [key]: v / 100 })} />
      ))}
    </fieldset>;
  const saved = <small className={styles.hint}>{signedIn ? "Saved to your account." : <SignInText text="Saved on this device. Sign in to keep them everywhere." />}</small>;
  if (!island) return <IslandSheet open={open} title="Settings" onClose={onClose} className={styles.settingsSheet} testId="settings-sheet">
    {textSize}{accessibility}{sound}{saved}
  </IslandSheet>;
  const tabs: { id: Tab; label: string }[] = [{ id: "graphics", label: "Graphics" }, { id: "sound", label: "Sound" }, { id: "controls", label: "Controls" }, { id: "account", label: "Account" },
    ...(dev ? [{ id: "dev" as const, label: "Dev" }] : [])];
  return <IslandSheet open={open} title="Settings" onClose={onClose} className={styles.settingsSheet} testId="settings-sheet">
    <Tabs label="Settings" value={tab} onChange={setTab} tabs={tabs} keyHints={[keyName(settings.key_bindings.prevTab), keyName(settings.key_bindings.nextTab)]} className={styles.settingsTabs} />
    {shows("graphics") && <>
    <fieldset>
      <legend>Look and performance</legend>
      <div className={styles.preset}>
        <span>Quality</span>
        <div className={styles.segmented} role="group" aria-label="Quality" data-testid="quality">
          {(["auto", "light", "high"] as const).map(q => <button key={q} aria-pressed={quality === q} onClick={() => setQuality(q)}>
            {q === "auto" ? `Auto${detectedTier ? ` · ${detectedTier === "light" ? "Lite" : "High"}` : ""}` : q === "light" ? "Lite" : "High"}
          </button>)}
        </div>
      </div>
      <Toggle checked={graphics.pixelated} onChange={on => graphicsActions.setPixelated(on)} hint="The world stays the same. Choose its finish.">Pixel finish</Toggle>
      <Toggle checked={graphics.shadows} disabled={graphics.liteMode} onChange={on => graphicsActions.setShadows(on)}>Shadows</Toggle>
      <Toggle checked={graphics.glassWater && !graphics.liteMode} disabled={graphics.liteMode} onChange={on => graphicsActions.setGlassWater(on)}>Glass water</Toggle>
      {/* Playtest round 1: the HUD keeps to the tracker, the minimap and the time while you play; this keeps coins and level up too. */}
      <Toggle checked={alwaysFullHud} onChange={setAlwaysFullHud}>Keep coins and level on screen</Toggle>
      <p className={styles.hint}>Otherwise they show when they change. Hold <kbd>{keyName(wheelKeys.hud)}</kbd>, or press <kbd>Esc</kbd>, to see everything.</p>
    </fieldset>
    {textSize}
    {accessibility}
    </>}
    {shows("sound") && sound}
    {shows("controls") && <>
    <fieldset>
      <legend>Camera</legend>
      <Toggle checked={camera.mouseLook} onChange={on => setOrbitPrefs({ mouseLook: on })}>Mouse look</Toggle>
      <Slider label="Sensitivity" min={SENSITIVITY_MIN * 100} max={SENSITIVITY_MAX * 100} step={5} value={Math.round(camera.sensitivity * 100)}
        format={v => `${v}%`} onChange={v => setOrbitPrefs({ sensitivity: v / 100 })} />
      <Toggle checked={camera.invertY} onChange={on => setOrbitPrefs({ invertY: on })}>Invert up and down</Toggle>
      <Toggle checked={camera.autoFollow} onChange={on => setOrbitPrefs({ autoFollow: on })}>Follow behind when you run</Toggle>
      <p className={styles.hint}>{camera.mouseLook ? "Click the island to look around with the mouse. Hold right click for a cursor; Esc lets the mouse go and shows the menu." : "The cursor stays free."} Arrow keys turn and tilt, the wheel and Z zoom, V puts the camera back. Kept on this device.</p>
    </fieldset>
    <fieldset>
      <legend>Menu keys</legend>
      <ul className={styles.keyList}>{REMAPPABLE_ACTIONS.map(a => <li key={a}>
        <span>{ACTION_LABEL[a]}</span>
        <button aria-pressed={listening === a} onClick={() => { setListening(a); setNote("Press a key (Esc to cancel)."); }}>
          {listening === a ? "Press a key…" : <kbd>{keyName(settings.key_bindings[a])}</kbd>}
        </button>
      </li>)}</ul>
      {note && <p className={styles.hint} role="status">{note}</p>}
    </fieldset>
    <fieldset>
      <legend>Movement keys</legend>
      <ul className={styles.keyList}>{MOVE_ROW.map(a => <li key={a.id}>
        <span>{a.name}{a.id === "dash" && !unlocks.dash && <small className={styles.hint}> · a Keeper teaches it</small>}</span>
        <button aria-pressed={moveListen === a.id} onClick={() => { setMoveListen(a.id); setMoveNote("Press a key (Esc to cancel)."); }}>
          {moveListen === a.id ? "Press a key…" : <kbd>{keyName(moveKeys[a.id])}</kbd>}
        </button>
      </li>)}
        <li><span>Glide{!unlocks.glider && <small className={styles.hint}> · a Keeper teaches it</small>}</span><span><kbd>{keyName(moveKeys.jump)}</kbd> again in the air</span></li>
        {/* The tool wheel (specs/game-ui.md): hold to open, tap to swap back; the full HUD while held (row 283); the
            emote wheel (specs/v1-drop.md §3): hold to open, tap to play the last emote again. */}
        {(["wheel", "hud", "emote"] as const).map(a => <li key={a}>
          <span>{a === "wheel" ? "Tool wheel (hold)" : a === "hud" ? "Coins and level (hold)" : "Emotes and dances (hold, tap repeats)"}</span>
          <button aria-pressed={wheelListen === a} onClick={() => { setWheelListen(a); setMoveNote("Press a key (Esc to cancel)."); }}>
            {wheelListen === a ? "Press a key…" : <kbd>{keyName(wheelKeys[a])}</kbd>}
          </button>
        </li>)}</ul>
      {/* Outside macOS Ctrl+W closes the tab and a page can't stop it: Ctrl crouches only in fullscreen with the keyboard locked. */}
      {!IS_MAC && canLockKeyboard() && (moveKeys.crouch !== "control" || !keyLock) && <p className={styles.hint}>
        {moveKeys.crouch === "control" ? `Ctrl crouches in fullscreen; until then ${crouchKey(moveKeys, false) ? keyName(crouchKey(moveKeys, false)) : "nothing"} does.` : "Ctrl can crouch and slide in fullscreen, where the keyboard is locked (hold Esc to leave)."}{" "}
        <Button size="sm" variant="quiet" onClick={() => { void playFullscreenWithCtrl(moveKeys).then(e => setMoveNote(e)); }}>Play fullscreen with Ctrl</Button>
      </p>}
      {moveNote && <p className={styles.hint} role="status">{moveNote}</p>}
    </fieldset>
    <fieldset data-testid="controls">
      <legend>Other controls</legend>
      <ul className={styles.keyList}>{FIXED_CONTROLS.map(c => <li key={c.label}><span>{c.label}</span><span>{c.keys.map(k => <kbd key={k}>{k}</kbd>)}</span></li>)}</ul>
      <p className={styles.hint}>On a touch screen: the stick walks (push it to the rim to run), tap the ground to go there, two fingers turn the camera.</p>
    </fieldset>
    {DROPS.combat && <fieldset>
      <legend>Ability keys (ruins)</legend>
      {/* Row 279: the slots on the number row or under the left hand; in the ruins they win over zoom (Z) and the camera reset (V). */}
      <div className={styles.segmented} role="group" aria-label="Ability key preset">
        {(["numbers", "zxcv"] as const).map(p => <button key={p} aria-pressed={abilityPreset(abilityKeys) === p} onClick={() => { const r = presetAbilities(abilityKeys, p); setAbilityNote(r.ok ? null : `${r.error} ${p === "zxcv" && !IS_MAC ? "C crouches here: move Crouch / slide first." : ""}`.trim()); }}>
          {p === "numbers" ? "1 2 3 4 5" : "Z X C V T"}
        </button>)}
      </div>
      <ul className={styles.keyList}>{ABILITIES.map(a => <li key={a.id}>
        <span>{a.name}</span>
        <button aria-pressed={abilityListen === a.id} onClick={() => { setAbilityListen(a.id); setAbilityNote("Press a key (Esc to cancel)."); }}>
          {abilityListen === a.id ? "Press a key…" : <kbd>{keyName(abilityKeys[a.id])}</kbd>}
        </button>
      </li>)}</ul>
      {abilityNote && <p className={styles.hint} role="status">{abilityNote}</p>}
    </fieldset>}
    </>}
    {shows("account") && <>
    <fieldset>
      <legend>You on the island</legend>
      {/* The classes and their auras are combat's drop (lib/game/drops.ts). */}
      {DROPS.classes && <Toggle checked={showClass} onChange={setShowClass}>Show class on my nameplate</Toggle>}
      {DROPS.classes && <Toggle checked={aura} onChange={setAuraVisible}>Show my aura</Toggle>}
      {/* The fishing pass's flags (specs/polish/fishing-questions.md), both on until David decides. */}
      <Toggle checked={fishingLine} onChange={on => setFishingFlag("line", on)}>Fishing line</Toggle>
      <Toggle checked={holdUpCatch} onChange={on => setFishingFlag("holdUp", on)} hint="Show off a catch in both hands while its card is up.">Hold up my catch</Toggle>
    </fieldset>
    <fieldset data-testid="account">
      <legend>Account</legend>
      {signedIn ? <>
        <p className={styles.hint}>Signed in as <b>{worldName}</b>.</p>
        <Button size="sm" variant="secondary" disabled={leaving} onClick={() => { setLeaving(true); void logOut(); }}>{leaving ? "Logging out…" : "Log out"}</Button>
      </> : <p className={styles.hint}><SignInText text="Playing as a guest. Sign in to keep your island, friends and settings." /></p>}
    </fieldset>
    </>}
    {dev && tab === "dev" && <fieldset data-testid="dev-tools"><legend>Dev tools</legend>{dev}</fieldset>}
    {saved}
  </IslandSheet>;
}
