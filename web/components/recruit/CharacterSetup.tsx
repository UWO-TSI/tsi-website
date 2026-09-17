"use client";
import { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import ApplicantCharacter from "./ApplicantCharacter";
import { ApplicantAppearanceContext, AVATAR_SKIN, AVATAR_HAIR, AVATAR_SHIRTS, type ApplicantAppearance } from "@/lib/game/applicantAppearance";
import styles from "./island.module.css";

export default function CharacterSetup({ appearance, onChange, onDone }: { appearance: ApplicantAppearance; onChange: (appearance: ApplicantAppearance) => void; onDone: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.querySelector<HTMLButtonElement>("button")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const buttons = [...(element?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    };
    element?.addEventListener("keydown", trap);
    return () => element?.removeEventListener("keydown", trap);
  }, []);
  const motion = useRef({ speed: 0, yaw: 0.18, lift: 0 });
  return <section ref={dialog} className={styles.characterSetup} role="dialog" aria-modal="true" aria-labelledby="character-title">
    <div className={styles.characterCard}>
      <div className={styles.characterPreview}>
        <ApplicantAppearanceContext.Provider value={appearance}>
          <Canvas camera={{ position: [0, 1.2, 3.4], fov: 36 }} onCreated={({ camera }) => camera.lookAt(0, 0.85, 0)}>
            <ambientLight intensity={1.8} /><directionalLight position={[2, 4, 3]} intensity={2} />
            <Suspense fallback={null}><ApplicantCharacter motion={motion} /></Suspense>
          </Canvas>
        </ApplicantAppearanceContext.Provider>
      </div>
      <div className={styles.characterOptions}>
        <span className={styles.eyebrow}>A quick hello</span><h1 id="character-title">Make yourself at home.</h1><p>Pick a look. You can change it later.</p>
        <fieldset><legend>Character</legend><div className={styles.avatarChoices}>{(["guy", "girl"] as const).map(body => <button key={body} aria-pressed={appearance.body === body} onClick={() => onChange({ ...appearance, body })}>{body === "guy" ? "Guy" : "Girl"}</button>)}</div></fieldset>
        {([{ field: "skin", label: "Skin", values: AVATAR_SKIN }, { field: "hair", label: "Hair colour", values: AVATAR_HAIR }, { field: "shirt", label: "Shirt", values: AVATAR_SHIRTS }] as const).map(({ field, label, values }) => <fieldset key={field}><legend>{label}</legend><div className={styles.swatches}>{values.map((color, i) => <button key={color} style={{ background: color }} aria-label={`${label} option ${i + 1}`} aria-pressed={appearance[field] === color} onClick={() => onChange({ ...appearance, [field]: color })} />)}</div></fieldset>)}
        <button className={styles.apply} onClick={onDone}>That’s me · Enter the village →</button>
      </div>
    </div>
  </section>;
}
