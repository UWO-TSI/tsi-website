"use client";

/**
 * Photo mode (specs/v1-drop.md §3, §9): P or the camera button opens it; P or Escape closes it. The HUD steps away, you
 * hold still, and the camera is free (PhotoCamera.tsx: drag to orbit and tilt, scroll or pinch to zoom, the arrow keys
 * too). Below: Orbit or Selfie, the depth of field, six filters and the natural look, four frames, any emote to pose
 * with (and a freeze to hold the pose), and the shutter. A snap shows framed, ready to save to your device (or share,
 * where the device can). Postcards by mail are v1.1. A world dialog, so the world's keys hold still while it's open.
 *
 * The live view and the saved photo agree (lib/game/photo.ts): the filter is the canvas's CSS filter here, with its
 * tint, glow, vignette and grain as overlays, and the same matrix and gradients over the snap's pixels (snap.ts).
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Aperture, Camera, Download, RotateCcw, Share2, X } from "lucide-react";
import { Button, IconButton, Slider } from "@/components/gui";
import { useWorldDialog, worldKeysBlocked, isTyping } from "@/lib/game/useWorldDialog";
import { AudioManager } from "@/lib/game/audio";
import { CLIP_BY_NAME } from "@/lib/game/character/look";
import { EMOTE_CLIP_NAMES } from "@/lib/net/protocol";
import { localAvatar } from "@/lib/net/localAvatar";
import { PHOTO_FILTERS, PHOTO_FRAMES, cssFilter, filterById, frameLayout, photoFileName, type FrameId } from "@/lib/game/photo";
import { photoRig, readPhoto, setPhoto, usePhoto } from "@/lib/game/photoMode";
import { grab, makePhoto } from "./snap";
import s from "./photo.module.css";

/** Plain names for the emote clips (the dances as David named them). */
const POSE_NAME: Record<string, string> = {
  Wave: "Wave", Dance: "Dance", Laugh: "Laugh", Cheer: "Cheer", Sad: "Sad", Clap: "Clap", Bow: "Bow", Shrug: "Shrug",
  DanceBounce: "Happy bounce", DanceSpin: "Little spin", DanceShuffle: "Shuffle", DanceSway: "Sway", DanceWiggle: "Wiggle",
  DanceFlail: "Goofy flail", DanceRobot: "Robot", DanceSprinkler: "Sprinkler", DanceStomp: "Stomp",
};
/** Every emote this rig has (the v1 wheel's as they land). */
const POSES = EMOTE_CLIP_NAMES.filter(c => CLIP_BY_NAME.has(c));

/** Hold your pose (the animation clock stopped) or let it go. */
function holdPose(on: boolean) {
  const m = localAvatar()?.motion.current;
  if (m) m.rate = on ? 0 : 1;
}

/** The live look: the filter on the canvas (through the page's --photo-filter) and its overlays. */
function Overlays({ filter, frame }: { filter: string; frame: FrameId }) {
  const f = filterById(filter);
  const l = frameLayout(frame, 1000, 625), fx = (l.photo.x / l.width) * 100, top = (l.photo.y / l.height) * 100, bottom = ((l.height - l.photo.y - l.photo.h) / l.height) * 100;
  return <div className={s.overlays} aria-hidden="true">
    {f.tint && <div className={s.tint} style={{ background: f.tint.color, opacity: f.tint.alpha, mixBlendMode: f.tint.blend } as CSSProperties} />}
    {f.glow && <div className={s.glow} style={{ background: `radial-gradient(circle at 50% 45%, ${f.glow.color}, transparent 55%)`, opacity: f.glow.alpha }} />}
    {f.vignette ? <div className={s.vignette} style={{ background: `radial-gradient(ellipse at center, rgba(20,14,10,0) 45%, rgba(20,14,10,${f.vignette}) 100%)` }} /> : null}
    {f.grain ? <div className={s.grain} style={{ opacity: f.grain * 2.2 }} /> : null}
    {/* The frame, over the edges of the view (the saved photo gets it round the whole picture). */}
    <div className={s.frame} data-frame={frame} style={{ borderWidth: `${top}vh ${fx}vw ${bottom}vh` }} />
  </div>;
}

function Preview({ url, onBack, onClose }: { url: string; onBack: () => void; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name] = useState(() => photoFileName(new Date()));
  useEffect(() => {
    let alive = true;
    void fetch(url).then(r => r.blob()).then(b => { if (alive) setFile(new File([b], name, { type: "image/png" })); });
    return () => { alive = false; };
  }, [url, name]);
  const canShare = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  return <div className={s.preview} role="dialog" aria-label="Your photo">
    {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing to optimise */}
    <img src={url} alt="Your photo of the island" className={s.shot} />
    <div className={s.previewActions}>
      <Button variant="quiet" onClick={onBack}><RotateCcw size={16} aria-hidden /> Take another</Button>
      {canShare && <Button variant="secondary" onClick={() => void navigator.share({ files: [file!], title: "Tethos Island" }).catch(() => {})}><Share2 size={16} aria-hidden /> Share</Button>}
      <a className={s.save} href={url} download={name}><Download size={16} aria-hidden /> Save to device</a>
      <Button variant="quiet" onClick={onClose}>Done</Button>
    </div>
  </div>;
}

export default function PhotoMode({ allowed }: {
  /** Photo mode may open now (the world is shown, nothing else holds you: no talk, trip, fishing or sheet). */
  allowed: boolean;
}) {
  const p = usePhoto();
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(0);
  const close = () => setPhoto({ open: false, freeze: false });
  const panel = useWorldDialog<HTMLDivElement>(p.open, close, ["p"]);
  const root = useRef<HTMLDivElement>(null);

  // P opens it (anywhere it's allowed, not while typing or another dialog is up); it closes through the dialog's keys.
  useEffect(() => {
    if (!allowed) return;
    const on = (e: KeyboardEvent) => {
      if (e.repeat || e.key.toLowerCase() !== "p" || e.metaKey || e.ctrlKey || e.altKey || readPhoto().open || worldKeysBlocked() || isTyping(e.target as Element)) return;
      setPhoto({ open: true });
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [allowed]);
  // Something took the world over (a cinematic, a sheet): photo mode steps aside.
  useEffect(() => { if (!allowed && readPhoto().open) setPhoto({ open: false, freeze: false }); }, [allowed]);
  // The filter on the canvas, through the page; your pose held or let go; a closed photo mode leaves nothing behind.
  useEffect(() => {
    const main = root.current?.closest("main") as HTMLElement | null;
    if (!main) return;
    main.style.setProperty("--photo-filter", p.open ? cssFilter(filterById(p.filter).fns) : "none");
  }, [p.open, p.filter]);
  useEffect(() => { holdPose(p.open && p.freeze); }, [p.open, p.freeze]);
  useEffect(() => {
    if (p.open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- closing drops the photo you were looking at
    setShot(old => { if (old) URL.revokeObjectURL(old); return null; });
  }, [p.open]);

  const snap = () => {
    if (busy) return;
    setBusy(true);
    setFlash(n => n + 1);
    AudioManager.playSFX("click", { rate: 0.8, gain: 0.5 });
    const { filter, frame } = readPhoto(), width = root.current?.closest("main")?.clientWidth ?? window.innerWidth;
    photoRig.ask = canvas => {
      const copy = grab(canvas);
      window.setTimeout(() => {
        makePhoto(copy, filterById(filter), frame, width, window.devicePixelRatio || 1)
          .then(b => setShot(URL.createObjectURL(b)))
          .catch(() => {})
          .finally(() => setBusy(false));
      }, 0);
    };
  };
  const pose = (clip: string) => {
    setPhoto({ freeze: false });
    window.dispatchEvent(new CustomEvent("tsi:emote", { detail: { clip } }));
  };

  if (!p.open) return <div ref={root} hidden />;
  return <div ref={root} className={s.root} data-photo-ui>
    <Overlays filter={p.filter} frame={p.frame} />
    {flash > 0 && <div key={flash} className={s.flash} aria-hidden="true" />}
    <div ref={panel} tabIndex={-1} className={s.ui} role="dialog" aria-label="Photo mode" data-testid="photo-mode">
      {shot ? <Preview url={shot} onBack={() => setShot(old => { if (old) URL.revokeObjectURL(old); return null; })} onClose={close} /> : <>
        <header className={s.top}>
          <p className={s.title}><Camera size={16} aria-hidden /> Photo mode</p>
          <p className={s.hint}>Drag to look around · scroll to zoom</p>
          <IconButton label="Close photo mode" size="sm" onClick={close}><X size={17} aria-hidden /></IconButton>
        </header>
        <section className={s.dock} aria-label="Photo settings">
          <div className={s.row}>
            <div className={s.seg} role="radiogroup" aria-label="Camera">
              {(["orbit", "selfie"] as const).map(c => <button key={c} type="button" role="radio" aria-checked={p.camera === c} onClick={() => { setPhoto({ camera: c }); photoRig.target.swing = 0; }}>{c === "orbit" ? "Orbit" : "Selfie"}</button>)}
            </div>
            <Slider className={s.focus} label={<><Aperture size={14} aria-hidden /> Focus</>} value={Math.round(p.focus * 100)} min={0} max={100}
              onChange={v => setPhoto({ focus: v / 100 })} format={v => (v === 0 ? "Off" : `${v}%`)} />
          </div>
          <div className={s.chips} role="radiogroup" aria-label="Filter">
            {PHOTO_FILTERS.map(f => <button key={f.id} type="button" role="radio" aria-checked={p.filter === f.id} className={s.chip} data-filter={f.id} onClick={() => setPhoto({ filter: f.id })}>{f.name}</button>)}
          </div>
          <div className={s.chips} role="radiogroup" aria-label="Frame">
            {PHOTO_FRAMES.map(f => <button key={f.id} type="button" role="radio" aria-checked={p.frame === f.id} className={s.chip} onClick={() => setPhoto({ frame: f.id })}>{f.name}</button>)}
          </div>
          <div className={s.chips} aria-label="Pose">
            {POSES.map(c => <button key={c} type="button" className={s.chip} onClick={() => pose(c)}>{POSE_NAME[c] ?? c}</button>)}
            <button type="button" className={s.chip} aria-pressed={p.freeze} data-hold onClick={() => setPhoto({ freeze: !p.freeze })}>{p.freeze ? "Holding pose" : "Hold pose"}</button>
          </div>
        </section>
        <button type="button" className={s.shutter} onClick={snap} disabled={busy} aria-label="Take a photo"><Camera size={26} aria-hidden /></button>
      </>}
    </div>
  </div>;
}

/** The HUD's camera button (photo mode). */
export function PhotoButton({ className, disabled }: { className?: string; disabled?: boolean }) {
  return <button className={className} disabled={disabled} onClick={() => setPhoto({ open: true })} aria-label="Photo mode" title="Photo mode (P)"><Camera size={18} aria-hidden /></button>;
}
