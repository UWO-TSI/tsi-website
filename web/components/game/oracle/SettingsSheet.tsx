"use client";

/**
 * Settings sheet (row 220) over the account settings (lib/identity/settings):
 * text size, high contrast, and menu key remap; the island's look and
 * performance (pixel finish, quality, shadows) are this device's
 * (useGraphicsSettings, hud-first-login §4). Remap listens for the next
 * key; taking another menu's key swaps the two; reserved keys are refused
 * with the systems rule's reason. Saved to the account when signed in,
 * otherwise kept on this device. The movement keys (jump, dash, sprint,
 * crouch/slide) and the ruins' ability keys are remapped on this device.
 * Outside macOS, Ctrl crouches only in fullscreen with the keyboard locked.
 */
import { useState, useSyncExternalStore } from "react";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import type { QualityTier } from "@/lib/game/qualityTier";
import { ACTION_LABEL, MENU_ACTIONS, TEXT_SIZES, normalizeKey, type MenuAction, type TextSize } from "@/lib/identity/settings";
import { saveSettings, setAuraVisible, useWorldIdentity } from "@/lib/game/identity";
import { ABILITIES, type AbilityId } from "@/lib/game/combat/runtime";
import { IS_MAC, MOVE_ACTIONS, abilityPreset, canLockKeyboard, crouchKey, keyName, playFullscreenWithCtrl, presetAbilities, remapAbility, remapMove, remapWheel, useAbilityKeys, useKeyboardLocked, useMoveKeys, useNextKey, useWheelKeys, type MoveAction } from "@/lib/game/movement/keys";
import { AudioManager, type AudioVolumes } from "@/lib/game/audio";
import { useAudioState } from "@/lib/game/useAudio";
import { orbit, readOrbitPrefs, setOrbitPrefs, subscribeOrbitPrefs, SENSITIVITY_MAX, SENSITIVITY_MIN } from "@/lib/game/orbitCamera";
import { setAlwaysFullHud, useAlwaysFullHud } from "@/lib/game/hudPrefs";
import { setComfort, useComfort, type ShakeLevel } from "@/lib/game/comfortSettings";
import IslandSheet from "../IslandSheet";
import styles from "../DefaultIslandWorld.module.css";

const SIZE_NAMES: Record<TextSize, string> = { small: "Small", default: "Standard", large: "Large", xl: "Largest" };
/** The movement keys row (specs/movement.md): Space jump, Q dash, Shift sprint, crouch/slide (Ctrl on macOS, C elsewhere). */
const MOVE_ROW = MOVE_ACTIONS.filter(a => a.id === "jump" || a.id === "dash" || a.id === "sprint" || a.id === "crouch");
const SOUND_SLIDERS: { key: keyof AudioVolumes; label: string }[] = [
  { key: "master", label: "Master" },
  { key: "music", label: "Music" },
  { key: "ambient", label: "Ambience" },
  { key: "sfx", label: "Sound effects" },
];

export default function SettingsSheet({ open, onClose, detectedTier = null }: { open: boolean; onClose: () => void; detectedTier?: QualityTier | null }) {
  const { settings, signedIn, aura } = useWorldIdentity();
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
  const moveKeys = useMoveKeys(), keyLock = useKeyboardLocked();
  const [moveListen, setMoveListen] = useState<MoveAction | null>(null);
  const [moveNote, setMoveNote] = useState<string | null>(null);
  const wheelKeys = useWheelKeys();
  const alwaysFullHud = useAlwaysFullHud();
  const comfort = useComfort();
  const [wheelListen, setWheelListen] = useState<"wheel" | "hud" | null>(null);
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
  if (!open) return null;
  return <IslandSheet title="Settings" onClose={onClose} className={styles.settingsSheet} testId="settings-sheet">
    <fieldset>
      <legend>Text size</legend>
      <div className={styles.segmented}>{TEXT_SIZES.map(s => <button key={s} aria-pressed={settings.text_size === s} onClick={() => void save({ text_size: s })}>{SIZE_NAMES[s]}</button>)}</div>
    </fieldset>
    <fieldset>
      <legend>Look and performance</legend>
      <label className={styles.toggle}><span>Pixel finish</span><input type="checkbox" checked={graphics.pixelated} onChange={e => graphicsActions.setPixelated(e.target.checked)} /></label>
      <p className={styles.hint}>The world stays the same. Choose its finish.</p>
      <label className={styles.preset}>
        <span>Quality</span>
        <select value={quality} onChange={e => setQuality(e.target.value)} data-testid="quality">
          <option value="auto">Auto · {detectedTier ? (detectedTier === "light" ? "Light" : "High") : "measuring"}</option>
          <option value="light">Light</option>
          <option value="high">High</option>
        </select>
      </label>
      <label className={styles.toggle}><span>Shadows</span><input type="checkbox" checked={graphics.shadows} disabled={graphics.liteMode} onChange={e => graphicsActions.setShadows(e.target.checked)} /></label>
      {/* Row 283: the HUD stays out of the way while you explore; this keeps it on. */}
      <label className={styles.toggle}><span>Show full HUD</span><input type="checkbox" checked={alwaysFullHud} onChange={e => setAlwaysFullHud(e.target.checked)} /></label>
      <p className={styles.hint}>Otherwise coins, XP, the clock and mail show when they change. Hold <kbd>{keyName(wheelKeys.hud)}</kbd>, or let go of the mouse, to see everything.</p>
    </fieldset>
    <fieldset>
      <legend>Camera</legend>
      <label className={styles.toggle}><span>Mouse look</span><input type="checkbox" checked={camera.mouseLook} onChange={e => setOrbitPrefs({ mouseLook: e.target.checked })} /></label>
      <div className={styles.sliderRow}>
        <label htmlFor="camera-sensitivity">Sensitivity</label>
        <input id="camera-sensitivity" type="range" min={SENSITIVITY_MIN * 100} max={SENSITIVITY_MAX * 100} step={5} value={Math.round(camera.sensitivity * 100)}
          aria-valuetext={`${Math.round(camera.sensitivity * 100)}%`} onChange={e => setOrbitPrefs({ sensitivity: Number(e.target.value) / 100 })} />
        <span>{Math.round(camera.sensitivity * 100)}</span>
      </div>
      <label className={styles.toggle}><span>Invert up and down</span><input type="checkbox" checked={camera.invertY} onChange={e => setOrbitPrefs({ invertY: e.target.checked })} /></label>
      <label className={styles.toggle}><span>Follow behind when you run</span><input type="checkbox" checked={camera.autoFollow} onChange={e => setOrbitPrefs({ autoFollow: e.target.checked })} /></label>
      <p className={styles.hint}>{camera.mouseLook ? "Click the island to look around with the mouse. Hold right click for a cursor; Esc lets the mouse go." : "The cursor stays free."} Arrow keys turn and tilt, the wheel and Z zoom, V puts the camera back. Kept on this device.</p>
    </fieldset>
    <label className={styles.toggle}><span>Show my family aura</span><input type="checkbox" checked={aura} onChange={e => setAuraVisible(e.target.checked)} /></label>
    <label className={styles.toggle}><span>High contrast</span><input type="checkbox" checked={settings.high_contrast} onChange={e => void save({ high_contrast: e.target.checked })} /></label>
    {/* Design sheet §1.6: the ult's flash frame and every flash obey these; both start calm when the device asks for reduced motion. */}
    <fieldset data-testid="accessibility">
      <legend>Accessibility</legend>
      <label className={styles.toggle}><span>Reduce flashing</span><input type="checkbox" checked={comfort.reduceFlashing} onChange={e => setComfort({ reduceFlashing: e.target.checked })} /></label>
      <p className={styles.hint}>Big hits darken the screen instead of flashing it, and their lines and glows are softer.</p>
      <div className={styles.preset}>
        <span>Screen shake</span>
        <div className={styles.segmented} role="group" aria-label="Screen shake">
          {(["full", "low", "off"] as ShakeLevel[]).map(l => <button key={l} aria-pressed={comfort.screenShake === l} onClick={() => setComfort({ screenShake: l })}>{l === "full" ? "Full" : l === "low" ? "Low" : "Off"}</button>)}
        </div>
      </div>
      <p className={styles.hint}>Kept on this device.</p>
    </fieldset>
    <fieldset>
      <legend>Sound</legend>
      {!audio.enabled && <button onClick={() => AudioManager.enable()}>Turn on sound</button>}
      <label className={styles.toggle}><span>Mute</span><input type="checkbox" checked={audio.muted} onChange={e => AudioManager.setMuted(e.target.checked)} /></label>
      {SOUND_SLIDERS.map(({ key, label }) => (
        <div key={key} className={styles.sliderRow}>
          <label htmlFor={`sound-${key}`}>{label}</label>
          <input id={`sound-${key}`} type="range" min={0} max={100} value={Math.round(audio.volumes[key] * 100)}
            aria-valuetext={`${Math.round(audio.volumes[key] * 100)}%`}
            onChange={e => AudioManager.setVolumes({ [key]: Number(e.target.value) / 100 })} />
          <span>{Math.round(audio.volumes[key] * 100)}</span>
        </div>
      ))}
    </fieldset>
    <fieldset>
      <legend>Menu keys</legend>
      <ul className={styles.keyList}>{MENU_ACTIONS.map(a => <li key={a}>
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
        <span>{a.name}</span>
        <button aria-pressed={moveListen === a.id} onClick={() => { setMoveListen(a.id); setMoveNote("Press a key (Esc to cancel)."); }}>
          {moveListen === a.id ? "Press a key…" : <kbd>{keyName(moveKeys[a.id])}</kbd>}
        </button>
      </li>)}
        {/* The tool wheel (specs/game-ui.md): hold to open, tap to swap back; the full HUD while held (row 283). */}
        {(["wheel", "hud"] as const).map(a => <li key={a}>
          <span>{a === "wheel" ? "Tool wheel (hold)" : "Full HUD (hold)"}</span>
          <button aria-pressed={wheelListen === a} onClick={() => { setWheelListen(a); setMoveNote("Press a key (Esc to cancel)."); }}>
            {wheelListen === a ? "Press a key…" : <kbd>{keyName(wheelKeys[a])}</kbd>}
          </button>
        </li>)}</ul>
      {/* Outside macOS Ctrl+W closes the tab and a page can't stop it: Ctrl crouches only in fullscreen with the keyboard locked. */}
      {!IS_MAC && canLockKeyboard() && (moveKeys.crouch !== "control" || !keyLock) && <p className={styles.hint}>
        {moveKeys.crouch === "control" ? `Ctrl crouches in fullscreen; until then ${crouchKey(moveKeys, false) ? keyName(crouchKey(moveKeys, false)) : "nothing"} does.` : "Ctrl can crouch and slide in fullscreen, where the keyboard is locked (hold Esc to leave)."}{" "}
        <button onClick={() => { void playFullscreenWithCtrl(moveKeys).then(e => setMoveNote(e)); }}>Play fullscreen with Ctrl</button>
      </p>}
      {moveNote && <p className={styles.hint} role="status">{moveNote}</p>}
    </fieldset>
    <fieldset>
      <legend>Ability keys (ruins)</legend>
      {/* Row 279: the slots on the number row or under the left hand; in the ruins they win over zoom (Z) and the camera reset (V). */}
      <div className={styles.segmented} role="group" aria-label="Ability key preset">
        {(["numbers", "zxcv"] as const).map(p => <button key={p} aria-pressed={abilityPreset(abilityKeys) === p} onClick={() => { const r = presetAbilities(abilityKeys, p); setAbilityNote(r.ok ? null : `${r.error} ${p === "zxcv" && !IS_MAC ? "C crouches here: move Crouch / slide first." : ""}`.trim()); }}>
          {p === "numbers" ? "1 2 3 4" : "Z X C V"}
        </button>)}
      </div>
      <ul className={styles.keyList}>{ABILITIES.map(a => <li key={a.id}>
        <span>{a.name}</span>
        <button aria-pressed={abilityListen === a.id} onClick={() => { setAbilityListen(a.id); setAbilityNote("Press a key (Esc to cancel)."); }}>
          {abilityListen === a.id ? "Press a key…" : <kbd>{keyName(abilityKeys[a.id])}</kbd>}
        </button>
      </li>)}</ul>
      {abilityNote && <p className={styles.hint} role="status">{abilityNote}</p>}
    </fieldset>
    <small className={styles.hint}>{signedIn ? "Saved to your account." : "Saved on this device. Sign in to keep them everywhere."}</small>
  </IslandSheet>;
}
