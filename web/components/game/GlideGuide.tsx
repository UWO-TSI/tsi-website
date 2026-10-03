"use client";

/**
 * The guided first glide (specs/polish/forage-craft-museum.md 7): once the leaf glider is first crafted, out on the
 * island the nearest good edge to run off gets a painted marker from our pack, a ring (the pack's marker, breathing,
 * with a glint now and then) lies where to come down, and a note says how. A real glide that lands in the ring is
 * cheered (a sparkle on the ring, the success sound, a toast) and the guide is done; a near miss says so and waits for
 * another go; Skip ends it (principle 7). The spot is read off the painted map (lib/game/glideGuide.ts), never placed.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Button, Card } from "@/components/gui";
import { AudioManager } from "@/lib/game/audio";
import { FINISH_GLINT, FINISH_SPARKS, GLINT, GLINT_TINT } from "@/lib/game/forageFx";
import { seedAt } from "@/lib/game/fx/particles";
import { finishGlideGuide, glideGuideDue, glideGuideView, glideSpot, guideStep, newGuide, setGlideGuideView, subscribeGlideGuide, RING_RADIUS, type GlideSpot, type Guide } from "@/lib/game/glideGuide";
import { iconUrl } from "@/lib/icons/keys";
import type { IslandMap } from "@/lib/game/grid";
import { packMap, spriteQuad } from "./movement/moveFx";
import { useGlowParticles } from "./GlowFx";
import styles from "./GlideGuide.module.css";

const RINGS = Array.from({ length: 8 }, (_, f) => spriteQuad("marker", f, 1).rotateX(-Math.PI / 2));
let edgeMat: THREE.MeshStandardMaterial | null = null, ringMat: THREE.MeshBasicMaterial | null = null;
const edgeLook = () => (edgeMat ??= new THREE.MeshStandardMaterial({ name: "GlideEdge", map: packMap(), color: "#f4f0d8", roughness: 1, transparent: true, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
const ringLook = () => (ringMat ??= new THREE.MeshBasicMaterial({ name: "GlideRing", map: packMap(), color: "#ffd77a", transparent: true, depthWrite: false, toneMapped: false,
  blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));

/** Module scope (the react compiler forbids writing through hook values): the ring breathes through the marker's frames. */
function breathe(ring: THREE.Mesh | null, t: number) {
  if (!ring) return;
  const f = Math.floor(t * 6) % 8;
  if (ring.geometry !== RINGS[f]) ring.geometry = RINGS[f];
}

export default function GlideGuide({ map, ground, player, owned, active }: {
  map: IslandMap; ground: (x: number, z: number) => number; player: React.RefObject<THREE.Vector3>;
  /** Owns the leaf glider (its unlock was crafted). */
  owned: boolean;
  /** The player is free to move (no fishing, no sheet, no greeting). */
  active: boolean;
}) {
  const due = useSyncExternalStore(subscribeGlideGuide, glideGuideDue, () => "none" as const);
  const on = due === "pending" && owned;
  // Where to try it from: worked out once, from where you are when it comes due.
  const [spot, setSpot] = useState<GlideSpot | null>(null);
  useEffect(() => {
    if (!on) return;
    const t = window.setTimeout(() => setSpot(s => s ?? glideSpot(map, player.current.x, player.current.z)), 0);
    return () => window.clearTimeout(t);
  }, [on, map, player]);
  const guide = useRef<Guide | null>(null);
  useEffect(() => { guide.current = spot ? newGuide(spot) : null; }, [spot]);
  const glow = useGlowParticles();
  const ring = useRef<THREE.Mesh>(null);
  const beat = useRef(-1);
  const heights = useMemo(() => (spot ? { edge: ground(spot.edge[0] - spot.dir[0] * 0.3, spot.edge[1] - spot.dir[1] * 0.3), land: ground(spot.land[0], spot.land[1]) } : null), [spot, ground]);
  useEffect(() => { if (on) setGlideGuideView({ phase: "hint", spot }); return () => setGlideGuideView({ phase: "hint", spot: null }); }, [on, spot]);
  useFrame(({ clock }) => {
    if (!on || !spot || !heights) return;
    breathe(ring.current, clock.elapsedTime);
    // A glint off the ring now and then, so it's easy to find from up on the edge.
    const b = Math.floor(clock.elapsedTime / 0.55);
    if (b !== beat.current) {
      beat.current = b;
      const a = b * 2.39;
      glow.pool.burst(GLINT, spot.land[0] + Math.cos(a) * RING_RADIUS * 0.8, heights.land + 0.2, spot.land[1] + Math.sin(a) * RING_RADIUS * 0.8, heights.land, 0, 0, 1, GLINT_TINT, b);
    }
    if (!active || !guide.current) return;
    const p = player.current, next = guideStep(guide.current, { x: p.x, z: p.z, aloft: p.y - ground(p.x, p.z) > 0.45 }, performance.now());
    if (next === guide.current) return;
    guide.current = next;
    // Said outside the frame loop: the HUD's note and the world's cheer.
    window.setTimeout(() => {
      setGlideGuideView({ phase: next.phase, spot });
      if (next.phase !== "done") return;
      glow.pool.burst(FINISH_GLINT, p.x, p.y + 0.9, p.z, p.y, 0, 0, 1.3, GLINT_TINT, seedAt(p.x, p.z, 95));
      glow.pool.burst(FINISH_SPARKS, spot.land[0], heights.land + 0.3, spot.land[1], heights.land, 0, 0, 1.5, GLINT_TINT, seedAt(p.x, p.z, 96));
      AudioManager.playSFX("confirm", { rate: 0.9, gain: 0.8 });
      window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: "Nice glide! The leaf goes wherever you can jump from.", icon: iconUrl("glider_leaf") } }));
      finishGlideGuide();
    }, 0);
  });
  if (!on || !spot || !heights) return null;
  const [ex, ez] = spot.edge, [lx, lz] = spot.land;
  return <group>
    {/* The edge to run off: a painted marker on its lip, turned to the way off it. */}
    <mesh geometry={RINGS[0]} material={edgeLook()} position={[ex - spot.dir[0] * 0.45, heights.edge + 0.03, ez - spot.dir[1] * 0.45]} scale={0.95} renderOrder={2} />
    {/* Where to come down. */}
    <mesh ref={ring} geometry={RINGS[0]} material={ringLook()} position={[lx, heights.land + 0.04, lz]} scale={RING_RADIUS * 2.1} renderOrder={2} />
  </group>;
}

/** The note that says how (and how it went), over the HUD while the guide is due; Skip ends it. */
export function GlideGuideHint({ show }: { show: boolean }) {
  const due = useSyncExternalStore(subscribeGlideGuide, glideGuideDue, () => "none" as const);
  const view = useSyncExternalStore(subscribeGlideGuide, glideGuideView, glideGuideView);
  if (!show || due !== "pending" || !view.spot) return null;
  const text = view.phase === "gliding" ? "That's it: hold jump and steer for the ring."
    : view.phase === "missed" ? "Nearly! Climb back up to the marker and aim for the ring."
    : "Your first glide: run off the marked edge, press jump again as you fall and hold it. Land in the ring.";
  return <Card className={styles.hint} role="status" data-testid="glide-guide">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={iconUrl("glider_leaf")} alt="" width={40} height={40} />
    <p>{text}</p>
    <Button size="sm" variant="quiet" onClick={finishGlideGuide}>Skip</Button>
  </Card>;
}
