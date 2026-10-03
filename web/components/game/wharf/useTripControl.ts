"use client";

/**
 * This player's boat trip, run from the island world (specs/polish/arrival-wharf.md deliverable 3; DefaultIslandWorld
 * calls it, so its own edits stay small): taking the boat at a pier, a first login's arrival at the village wharf, the
 * scene change under the veil (the next island loads and warms up before the boat comes in), a key or a tap to skip,
 * and handing the avatar and the camera back at the end. The trip itself steps on the boat that carries it (useTripBoat).
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { arrivalTrip, skipTrip, startTrip, stepTrip, type BoatTrip, type TripPhase, type TripPlace } from "@/lib/game/boatTrip";
import { myTrip, readMyTrip, subscribeMyTrip, tripChanged } from "@/lib/game/myTrip";
import { worldToDock, type Dock } from "@/lib/game/wharf";
import { worldNow } from "@/lib/game/worldClock";
import { escapeEndedCapture, orbit } from "@/lib/game/orbitCamera";
import { isTyping } from "@/lib/game/useWorldDialog";

/** Keys that skip the trip (a tap on a touch screen does too). */
const SKIP_KEYS = [" ", "enter", "e", "escape"];
/** Trips whose island has been switched to already (a skip while coming in loads nothing new). */
const switched = new WeakSet<BoatTrip>();

/** The island world's scene gate says the scene is ready: a trip waiting under its veil can come in. */
export function tripSceneReady() {
  const t = myTrip.current;
  if (!t || t.phase !== "load") return;
  myTrip.loaded = true;
  if (stepTrip(t, worldNow(), true)) tripChanged();
}

function skip() {
  const t = myTrip.current;
  if (t && skipTrip(t, worldNow())) tripChanged();
}

export interface TripControl {
  active: boolean; phase: TripPhase | null; to: TripPlace; firstLogin: boolean; quick: boolean;
  /** Take the boat from `from`'s pier to `to`, from where the avatar stands. */
  start: (from: TripPlace, to: TripPlace) => void;
  /** A first login's arrival at `to` (the island already `showing`, or still under the loading screen). */
  arrive: (to: TripPlace, showing: boolean) => void;
  skip: () => void;
}

/**
 * `dockOf`: each island's pier (the traveller's spot is put in its frame). `goTo`: change the scene to that island under
 * the veil (the world's site switch and a fresh scene gate). `ready`: the scene on screen has warmed up. `onDone`: the
 * avatar is yours again (a first login's greeting starts there).
 */
export function useTripControl({ dockOf, goTo, site, ready, onDone }: {
  dockOf: (place: TripPlace) => Dock | null; goTo: (place: TripPlace) => void; site: string; ready: boolean; onDone?: (trip: BoatTrip) => void;
}): TripControl {
  const key = useSyncExternalStore(subscribeMyTrip, readMyTrip, () => "");
  const trip = key ? myTrip.current : null;
  const phase = trip?.phase ?? null;

  const start = useCallback((from: TripPlace, to: TripPlace) => {
    const dock = dockOf(from);
    if (myTrip.current || !dock) return;
    const r = myTrip.ride, at = worldToDock(dock, r.x, r.z, { x: 0, z: 0 });
    myTrip.current = startTrip("me", from, to, { x: at.x, z: at.z, yaw: r.yaw - dock.yaw }, worldNow());
    myTrip.loaded = false;
    myTrip.camera = { pitch: orbit.target.pitch, zoom: orbit.target.zoom };
    tripChanged();
  }, [dockOf]);
  const arrive = useCallback((to: TripPlace, showing: boolean) => {
    if (myTrip.current) return;
    myTrip.current = arrivalTrip("me", to, worldNow(), showing);
    myTrip.loaded = false;
    myTrip.camera = { pitch: orbit.target.pitch, zoom: orbit.target.zoom };
    tripChanged();
  }, []);

  // Under the full veil the next island takes over the screen: the first time, the scene changes to it (and its gate
  // reports when it has warmed up); a skip while coming in has nothing new to load.
  useEffect(() => {
    const t = myTrip.current;
    if (!t || t.phase !== "load") return;
    if (!switched.has(t)) { switched.add(t); myTrip.loaded = false; goTo(t.to); }
    else if (site === t.to && ready) tripSceneReady();
  }, [key, goTo, site, ready]);

  // Ashore: the avatar and the camera are yours again.
  useEffect(() => {
    const t = myTrip.current;
    if (!t || t.phase !== "done") return;
    myTrip.current = null;
    myTrip.ride.active = false;
    tripChanged();
    onDone?.(t);
  }, [key, onDone]);

  // Dev (evidence scripts): where the trip is, and starting, arriving and skipping without the prompt.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    Object.assign(window, { __trip: { state: () => { const t = myTrip.current; return t && { phase: t.phase, t: (worldNow() - t.at) / 1000, leg: t.leg, to: t.to }; }, start, arrive, skip } });
  }, [start, arrive]);

  // A key or a tap skips; the keys are the trip's while it runs (nothing else in the world takes them).
  const active = !!trip;
  useEffect(() => {
    if (!active) return;
    const press = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.repeat || !SKIP_KEYS.includes(k) || isTyping(e.target as Element)) return;
      if (k === "escape" && escapeEndedCapture()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      skip();
    };
    const tap = (e: PointerEvent) => { if (e.pointerType === "touch" && !(e.target as Element | null)?.closest?.("button")) skip(); };
    window.addEventListener("keydown", press, true);
    window.addEventListener("pointerdown", tap, true);
    return () => { window.removeEventListener("keydown", press, true); window.removeEventListener("pointerdown", tap, true); };
  }, [active]);

  return { active, phase, to: trip?.to ?? "village", firstLogin: trip?.from === "sea", quick: !!trip?.skip && trip.skip.phase !== "veil" && trip.skip.phase !== "load", start, arrive, skip };
}
