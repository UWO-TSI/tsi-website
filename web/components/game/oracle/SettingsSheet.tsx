"use client";

/**
 * Settings sheet (row 220) over the account settings (lib/identity/settings):
 * text size, high contrast, and menu key remap. Remap listens for the next
 * key; taking another menu's key swaps the two; reserved keys are refused
 * with the systems rule's reason. Saved to the account when signed in,
 * otherwise kept on this device.
 */
import { useEffect, useState } from "react";
import { ACTION_LABEL, MENU_ACTIONS, TEXT_SIZES, normalizeKey, type MenuAction, type TextSize } from "@/lib/identity/settings";
import { keyLabel, saveSettings, setAuraVisible, useWorldIdentity } from "@/lib/game/identity";
import { ABILITIES, readAbilityKeys, remapAbility, type AbilityId } from "@/lib/game/combat/runtime";
import IslandSheet from "../IslandSheet";
import styles from "../DefaultIslandWorld.module.css";

const SIZE_NAMES: Record<TextSize, string> = { small: "Small", default: "Standard", large: "Large", xl: "Largest" };

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, signedIn, aura } = useWorldIdentity();
  const [listening, setListening] = useState<MenuAction | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [abilityKeys, setAbilityKeys] = useState(readAbilityKeys);
  const [abilityListen, setAbilityListen] = useState<AbilityId | null>(null);
  const [abilityNote, setAbilityNote] = useState<string | null>(null);
  useEffect(() => {
    if (!abilityListen) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === "Escape") { setAbilityListen(null); setAbilityNote(null); return; }
      const r = remapAbility(abilityKeys, abilityListen, e.key);
      if (!r.ok) { setAbilityNote(r.error); return; }
      setAbilityKeys(r.keys); setAbilityListen(null); setAbilityNote(null);
      window.dispatchEvent(new Event("tsi:ability-keys"));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [abilityListen, abilityKeys]);
  const save = async (patch: Parameters<typeof saveSettings>[0], ok?: string) => {
    const error = await saveSettings(patch);
    setNote(error ?? ok ?? null);
  };
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === "Escape") { setListening(null); setNote(null); return; }
      const key = normalizeKey(e.key);
      const other = MENU_ACTIONS.find(a => a !== listening && settings.key_bindings[a] === key);
      const patch = { ...settings.key_bindings, [listening]: key, ...(other ? { [other]: settings.key_bindings[listening] } : {}) };
      const action = listening;
      void saveSettings({ key_bindings: patch }).then(error => {
        if (error) { setNote(error); return; }
        setListening(null);
        setNote(`${ACTION_LABEL[action]} is now ${keyLabel(key)}.${other ? ` ${ACTION_LABEL[other]} moved to ${keyLabel(settings.key_bindings[action])}.` : ""}`);
      });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening, settings.key_bindings]);
  if (!open) return null;
  return <IslandSheet title="Settings" onClose={onClose} className={styles.settingsSheet} testId="settings-sheet">
    <fieldset>
      <legend>Text size</legend>
      <div className={styles.segmented}>{TEXT_SIZES.map(s => <button key={s} aria-pressed={settings.text_size === s} onClick={() => void save({ text_size: s })}>{SIZE_NAMES[s]}</button>)}</div>
    </fieldset>
    <label className={styles.toggle}><span>Show my family aura</span><input type="checkbox" checked={aura} onChange={e => setAuraVisible(e.target.checked)} /></label>
    <label className={styles.toggle}><span>High contrast</span><input type="checkbox" checked={settings.high_contrast} onChange={e => void save({ high_contrast: e.target.checked })} /></label>
    <fieldset>
      <legend>Menu keys</legend>
      <ul className={styles.keyList}>{MENU_ACTIONS.map(a => <li key={a}>
        <span>{ACTION_LABEL[a]}</span>
        <button aria-pressed={listening === a} onClick={() => { setListening(a); setNote("Press a key (Esc to cancel)."); }}>
          {listening === a ? "Press a key…" : <kbd>{keyLabel(settings.key_bindings[a])}</kbd>}
        </button>
      </li>)}</ul>
      {note && <p className={styles.hint} role="status">{note}</p>}
    </fieldset>
    <fieldset>
      <legend>Ability keys (ruins)</legend>
      <ul className={styles.keyList}>{ABILITIES.map(a => <li key={a.id}>
        <span>{a.name}</span>
        <button aria-pressed={abilityListen === a.id} onClick={() => { setAbilityListen(a.id); setAbilityNote("Press a key (Esc to cancel)."); }}>
          {abilityListen === a.id ? "Press a key…" : <kbd>{abilityKeys[a.id].toUpperCase()}</kbd>}
        </button>
      </li>)}</ul>
      {abilityNote && <p className={styles.hint} role="status">{abilityNote}</p>}
    </fieldset>
    <small className={styles.hint}>{signedIn ? "Saved to your account." : "Saved on this device. Sign in to keep them everywhere."}</small>
  </IslandSheet>;
}
