"use client";

/**
 * Settings sheet (row 220) over the account settings (lib/identity/settings):
 * text size, high contrast, and menu key remap. Remap listens for the next
 * key; taking another menu's key swaps the two; reserved keys are refused
 * with the systems rule's reason. Saved to the account when signed in,
 * otherwise kept on this device. The movement keys (jump, dash, sprint,
 * sneak) and the ruins' ability keys are remapped on this device.
 */
import { useState } from "react";
import { ACTION_LABEL, MENU_ACTIONS, TEXT_SIZES, normalizeKey, type MenuAction, type TextSize } from "@/lib/identity/settings";
import { saveSettings, setAuraVisible, useWorldIdentity } from "@/lib/game/identity";
import { ABILITIES, type AbilityId } from "@/lib/game/combat/runtime";
import { MOVE_ACTIONS, keyName, remapAbility, remapMove, useAbilityKeys, useMoveKeys, useNextKey, type MoveAction } from "@/lib/game/movement/keys";
import { AudioManager, type AudioVolumes } from "@/lib/game/audio";
import { useAudioState } from "@/lib/game/useAudio";
import IslandSheet from "../IslandSheet";
import styles from "../DefaultIslandWorld.module.css";

const SIZE_NAMES: Record<TextSize, string> = { small: "Small", default: "Standard", large: "Large", xl: "Largest" };
/** The movement keys row (specs/movement.md): Space jump, Q dash, Shift sprint, C sneak. */
const MOVE_ROW = MOVE_ACTIONS.filter(a => a.id === "jump" || a.id === "dash" || a.id === "sprint" || a.id === "sneak");
const SOUND_SLIDERS: { key: keyof AudioVolumes; label: string }[] = [
  { key: "master", label: "Master" },
  { key: "music", label: "Music" },
  { key: "ambient", label: "Ambience" },
  { key: "sfx", label: "Sound effects" },
];

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, signedIn, aura } = useWorldIdentity();
  const audio = useAudioState();
  const [listening, setListening] = useState<MenuAction | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const abilityKeys = useAbilityKeys();
  const [abilityListen, setAbilityListen] = useState<AbilityId | null>(null);
  const [abilityNote, setAbilityNote] = useState<string | null>(null);
  const moveKeys = useMoveKeys();
  const [moveListen, setMoveListen] = useState<MoveAction | null>(null);
  const [moveNote, setMoveNote] = useState<string | null>(null);
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
    <label className={styles.toggle}><span>Show my family aura</span><input type="checkbox" checked={aura} onChange={e => setAuraVisible(e.target.checked)} /></label>
    <label className={styles.toggle}><span>High contrast</span><input type="checkbox" checked={settings.high_contrast} onChange={e => void save({ high_contrast: e.target.checked })} /></label>
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
      </li>)}</ul>
      {moveNote && <p className={styles.hint} role="status">{moveNote}</p>}
    </fieldset>
    <fieldset>
      <legend>Ability keys (ruins)</legend>
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
