/**
 * One cast from the wind-up to the card (the fishing overlays' shared rules; specs/polish/fishing.md, specs/launch/
 * v1-gameplay.md "Fish tiers and fights"): the state machine both overlays drive, the applicant island's
 * (components/game/FishingOverlay.tsx) and the member island's (components/game/fishing/MemberFishing.tsx), so neither
 * owns a copy. It listens for `tsi:fish-start` from the world's E handler at a fishing spot, then runs
 *
 *   charging (the cast meter) → casting → waiting (2-6 s) → bite (the hook window) → [surfacing] → reeling → revealing
 *
 * and says each beat to the world in `tsi:fish-*` events (the rod, the bobber, the "!" and the catch draw from them).
 * On the member island the server rolls the fish when the line is cast and records it when the reel is won (or, in a
 * divine raid, with the room's signed credit); signed out, and on the applicant island, it rolls here and stays in this
 * browser. The overlays only draw what it returns.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioManager } from "./audio";
import { castLine, claimRaid, collect, landCatch, localCollections, localRecord, mergeWithLocal, type CatchAnswer } from "./collections";
import { rodByTier, type RodTier } from "./rods";
import { rollFishFor } from "./peaceful";
import type { WaterType } from "./fishingSpots";
import { punchZoom, setAimZoom, setTensionZoom, shakeCamera } from "./cameraJuice";
import { CAST, TOGETHER, FISH, HOOK, HOOK_TIER, bossOf, catchShake, currentFishingContext, rollFish, rollSize, type FishDef } from "./fishing";
import { weatherMods } from "./weatherPerks";
import { liveIslandWeather, reelWeather } from "./islandWeather";
import { raidNow, sendRaid } from "@/lib/net/raid";
import { bindFishingCastLifecycle, castDevice, trackCastDevice, type CastDevice, type FishingHeldInput } from "./fishingInput";
import { isGameControlTarget } from "./keyboardInput";
import { remoteNearest } from "@/components/game/net/active";
import { friendsStore } from "@/lib/net/friends";

export type FishingPhase = "idle" | "charging" | "casting" | "waiting" | "bite" | "surfacing" | "reeling" | "revealing" | "missed";

const BITE_WINDOW_MS = 1400;
/** The catch card arrives this long after the reel is won: the world's beat first (the fish out of the water and into your hands). */
const REVEAL_DELAY_MS = 520;
/** A boss catch's (legendary, divine) card waits for its landing in the world (fishing/BossCreature.tsx). */
const BOSS_REVEAL_DELAY_MS = 1900;
/** How far the camera leans in (degrees of field of view) on you and the catch while its card is up: a touch, so the
 *  catch held at your chin stays above the card. */
const REVEAL_ZOOM = 4;
/** The wait starts when the bobber lands (tsi:fish-splash); this long after the cast it starts anyway (no bobber mounted). */
const LANDING_FALLBACK_MS = 1600;

export interface FishingSessionOptions {
  onActiveChange?: (active: boolean) => void;
  /** Collect into this browser's scoped record (the applicant island, the lab) instead of the member's account. */
  collectionScope?: string;
  zoneOverride?: "river" | "sea";
  /** The held rod (rods.ts): it widens the hook window, slows the drain and adds rare luck. */
  rod?: RodTier;
}

export function useFishingSession({ onActiveChange, collectionScope, zoneOverride, rod = rodByTier(1) }: FishingSessionOptions) {
  const [phase, setPhase] = useState<FishingPhase>("idle");
  const phaseRef = useRef<FishingPhase>("idle");
  const releaseRequestedRef = useRef(false);
  const reelInputRef = useRef<FishingHeldInput>({ keys: new Set(), pointers: new Set() });
  const changePhase = useCallback((next: FishingPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const active = phase !== "idle";
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);
  const [fish, setFish] = useState<FishDef | null>(null);
  const [caughtSize, setCaughtSize] = useState<number | null>(null);
  const [wasNew, setWasNew] = useState(false);
  const [newRecord, setNewRecord] = useState(false);
  const [learned, setLearned] = useState<string | null>(null); // a recipe the landed catch taught
  const [buddy, setBuddy] = useState<string | null>(null); // the friend this one was fished with (s-fishtogether)
  const [missNote, setMissNote] = useState<string | null>(null);
  // The hints name the input that started the cast (E, the click or a tap): fishingInput.ts FISHING_HINTS.
  const [device, setDevice] = useState<CastDevice>("mouse");
  useEffect(() => trackCastDevice(), []);
  const waterRef = useRef<WaterType | null>(null);
  const castFromRef = useRef<{ site: "village" | "home"; from: [number, number] } | null>(null);
  // The server's roll for this cast (null: roll here), and once hooked, the roll to land.
  const rollRef = useRef<Promise<CatchAnswer | null> | null>(null);
  const landRef = useRef<{ roll: string; size: number | null } | null>(null);
  const hookedRef = useRef(false);
  /** The fight a boss catch puts up (a divine with no raid to open fights solo), and the raid it's part of. */
  const [bossMode, setBossMode] = useState<"solo" | "shared" | null>(null);
  const [raidId, setRaidId] = useState<string | undefined>(undefined);
  const raidIdRef = useRef<string | undefined>(undefined);
  const joinRaidAs = (id: string | undefined) => { raidIdRef.current = id; setRaidId(id); };
  /** The fish on the bite (rolled as it bites), hooked into the reel. */
  const bitingRef = useRef<FishDef | null>(null);
  /** A landed catch goes into the bag as its card closes (the HUD's fly-in then, from where it was held up). */
  const pendingBagRef = useRef<string | null>(null);
  useEffect(() => {
    const onStart = (e: Event) => {
      const d = (e as CustomEvent<{ water?: WaterType; site?: "village" | "home"; from?: [number, number] }>).detail;
      waterRef.current = d?.water ?? null;
      castFromRef.current = d?.site && d.from ? { site: d.site, from: d.from } : null;
    };
    window.addEventListener("tsi:fish-start", onStart, true);
    return () => window.removeEventListener("tsi:fish-start", onStart, true);
  }, []);
  const timersRef = useRef<number[]>([]);
  const biteDeadlineRef = useRef(0);
  // Discovery survives depleted stock and unavailable account sync.
  // Unknown species keep the ??? silhouette until their first catch.
  const ownedRef = useRef<Set<string>>(new Set());
  // Cast meter (David 2026-07-23): hold E → ping-pong power bar, release
  // at the tip = MAX CAST. Power scales luck AND bite timing.
  const powerRef = useRef(0);
  const [maxCast, setMaxCast] = useState(false);
  // Fishing spot from the world's E handler — the bobber lands relative to it.
  const spotRef = useRef<{ x: number; z: number } | null>(null);

  useEffect(() => {
    for (const key of Object.keys(localCollections(collectionScope))) ownedRef.current.add(key);
    if (collectionScope) return;
    fetch("/api/collections")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.collections) {
          const rows = d.collections as { item_key: string; count: number }[];
          const counts = mergeWithLocal(Object.fromEntries(rows.map((row) => [row.item_key, row.count])));
          for (const key of Object.keys(counts)) ownedRef.current.add(key);
        }
      })
      .catch(() => {});
  }, [collectionScope]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const cancel = useCallback(() => {
    clearTimers();
    releaseRequestedRef.current = false;
    reelInputRef.current.keys.clear(); reelInputRef.current.pointers.clear();
    changePhase("idle");
    setFish(null);
    setCaughtSize(null);
    setWasNew(false);
    setNewRecord(false);
    setMissNote(null);
    setMaxCast(false);
    powerRef.current = 0;
    rollRef.current = null;
    landRef.current = null;
    hookedRef.current = false;
    bitingRef.current = null;
    if (raidIdRef.current) sendRaid({ op: "leave", id: raidIdRef.current });
    joinRaidAs(undefined);
    setBossMode(null);
    setTensionZoom(0);
    setAimZoom(0);
    window.dispatchEvent(new CustomEvent("tsi:fish-end"));
    const key = pendingBagRef.current;
    pendingBagRef.current = null;
    if (key) window.dispatchEvent(new CustomEvent("tsi:bag-got", { detail: { key } }));
  }, [changePhase]);

  /** A full bag (specs/game-ui.md §5): the note over the water, besides the card's own words. */
  const bagFull = (answer: { code?: string }) => {
    if (answer.code === "bag_full") window.dispatchEvent(new CustomEvent("tsi:bag-full", { detail: { x: spotRef.current?.x, z: spotRef.current?.z } }));
  };
  const miss = (note: string | null = null) => {
    clearTimers();
    setMissNote(note);
    changePhase("missed");
    // A refusal says why on the card (a full bag also shakes the Bag button, with its own sound): no door sound here.
    timersRef.current.push(window.setTimeout(cancel, 1800));
  };

  const beginWait = () => {
    if (phaseRef.current !== "casting") return;
    changePhase("waiting");
    // Cast power shortens the wait (max cast halves it); rain days shorten
    // it further (weather perk).
    const wait = (2000 + Math.random() * 4000) * (1 - CAST.waitScale * powerRef.current) * weatherMods(reelWeather(liveIslandWeather())).biteWaitMul * rod.waitMul;
    // Fake nibbles (refinement 2026-07-23): 1-2 false-alarm tugs, never in
    // the last 1.2s before the real bite. Bobber dips + ripple + soft blip.
    if (wait > 2600) {
      const count = Math.random() < 0.7 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const at = wait * 0.25 + Math.random() * (wait - 1200 - wait * 0.25);
        timersRef.current.push(
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent("tsi:fish-nibble"));
            shakeCamera(0.012); // the faintest tug
          }, at)
        );
      }
    }
    timersRef.current.push(window.setTimeout(bite, wait));
  };

  /** What bites is known before its "!" (its tier picks the "!", the sound and the shake): the cast's server roll, or one here. */
  const bite = () => {
    const roll = rollRef.current;
    void (roll ?? Promise.resolve(null)).then(answer => {
      // A refusal already ended the cast (castNow); a cancelled or newer cast isn't this one.
      if (phaseRef.current !== "waiting" || rollRef.current !== roll || (answer && !answer.ok)) return;
      const rolled = answer && FISH.find(f => f.key === answer.catch.item_key);
      landRef.current = rolled && answer.catch.roll ? { roll: answer.catch.roll, size: answer.catch.size_cm } : null;
      setBuddy(rolled ? answer.catch.together ?? null : null);
      const biting = rolled || rollHere();
      bitingRef.current = biting;
      const tier = HOOK_TIER[biting.rarity], hookBeat = HOOK[tier];
      changePhase("bite");
      punchZoom(hookBeat.punch); // micro-zoom: the strike
      window.dispatchEvent(new CustomEvent("tsi:fish-bite", { detail: { tier } })); // the bobber pulled under in a crown of water, the "!"
      // The bite lands on the camera (the world's shake, the Screen shake setting), never the page.
      shakeCamera(hookBeat.shake);
      AudioManager.playSFX(hookBeat.sfx);
      // Cast power widens the hook window (max cast: 1.4s → 2.2s).
      const windowMs = BITE_WINDOW_MS + CAST.biteBonusMs * powerRef.current + rod.biteWindowMs;
      biteDeadlineRef.current = performance.now() + windowMs;
      // Auto-miss if the window lapses: the fish lets go and the bobber bobs back up.
      timersRef.current.push(
        window.setTimeout(() => {
          changePhase("missed");
          window.dispatchEvent(new CustomEvent("tsi:fish-escaped", { detail: { hooked: false } }));
          timersRef.current.push(window.setTimeout(cancel, 1800));
        }, windowMs)
      );
    });
  };

  /** The local roll (signed out, the applicant island, no server answer): rod- and water-aware where the spot says its water. */
  const rollHere = () => {
    const luck = powerRef.current + (powerRef.current >= CAST.maxZone ? CAST.maxBonus : 0);
    // Every world cast names its water (tsi:fish-start); the applicant's shore casts roll the sea.
    const zone: "river" | "sea" = zoneOverride ?? "river";
    return waterRef.current ? rollFishFor(waterRef.current, luck, rod, currentFishingContext()) : rollFish(luck + rod.rarityBonus, zone);
  };

  /** Meter released → actually cast, with power locked in. */
  const castNow = (power: number) => {
    if (phaseRef.current !== "charging") return;
    clearTimers();
    setFish(null);
    setCaughtSize(null);
    setWasNew(false);
    powerRef.current = power;
    const isMax = power >= CAST.maxZone;
    setMaxCast(isMax);
    // Nailing the meter's gold tip is the meter's own chime; the cast itself waits for its whoosh (fishing-questions).
    if (isMax) {
      punchZoom(2.5); // micro-zoom: nailed the tip
      AudioManager.playSFX("confirm");
    }
    changePhase("casting");
    // Member island: the server rolls what will bite now; a refusal (too soon, no water here) ends the cast.
    const from = collectionScope ? null : castFromRef.current;
    // Fishing together: the nearest friend within a few steps rides along on the cast (the server checks the friendship).
    rollRef.current = from && castLine(from.site, from.from, power, rod.key, rod.tackle, remoteNearest(from.from[0], from.from[1], TOGETHER.range, uid => friendsStore().isFriend(uid)));
    void rollRef.current?.then(answer => {
      if (answer && !answer.ok && (phaseRef.current === "casting" || phaseRef.current === "waiting")) { bagFull(answer); miss(answer.error); }
    });
    hookedRef.current = false;
    landRef.current = null;
    const spot = spotRef.current ?? { x: 0, z: 0 };
    window.dispatchEvent(new CustomEvent("tsi:fish-cast", { detail: { x: spot.x, z: spot.z, power } }));
    timersRef.current.push(window.setTimeout(beginWait, LANDING_FALLBACK_MS));
  };

  // The wait starts as the bobber lands (FishingBobber's tsi:fish-splash), not on a guess at its flight.
  useEffect(() => {
    if (phase !== "casting") return;
    const onSplash = () => beginWait();
    window.addEventListener("tsi:fish-splash", onSplash);
    return () => window.removeEventListener("tsi:fish-splash", onSplash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /** Bite hooked (E or click) → the fish that bit, into the reel. */
  const hook = (input: KeyboardEvent | PointerEvent) => {
    if (phaseRef.current !== "bite" || hookedRef.current) return;
    if (performance.now() > biteDeadlineRef.current) return;
    hookedRef.current = true;
    clearTimers();
    reelInputRef.current.keys.clear(); reelInputRef.current.pointers.clear();
    if ("key" in input) reelInputRef.current.keys.add(input.key.toLowerCase());
    else reelInputRef.current.pointers.add(input.pointerId);
    const hooked = bitingRef.current;
    if (!hooked) return;
    setFish(hooked);
    const tier = HOOK_TIER[hooked.rarity];
    let mode = bossOf(hooked.rarity);
    // A divine opens the shard's raid (protocol.ts note 11) for the roll on your line (the web checks it before any credit;
    // a dev room without one names a stand-in); with no room to raid in, it's yours alone.
    const at = spotRef.current, roll = landRef.current?.roll ?? crypto.randomUUID();
    if (mode === "shared" && !(at && sendRaid({ op: "open", fish: hooked.key, roll, x: at.x, z: at.z }))) mode = "solo";
    setBossMode(mode);
    if (!mode) changePhase("reeling");
    else {
      // The cutscene: the camera pulls out and it surfaces; then the fight.
      changePhase("surfacing");
      window.dispatchEvent(new CustomEvent("tsi:boss-surface", { detail: { tier } }));
      timersRef.current.push(window.setTimeout(() => {
        if (phaseRef.current !== "surfacing") return;
        if (mode === "shared") {
          const raid = raidNow();
          if (raid.joined && raid.fish === hooked.key && !raid.result) joinRaidAs(raid.id);
          else setBossMode("solo");
        }
        changePhase("reeling");
      }, HOOK[tier].surfaceMs));
    }
    // The yank, the line taut, the reel; the species' model rides along so the world has it ready when it comes out.
    window.dispatchEvent(new CustomEvent("tsi:fish-hooked", { detail: { model: hooked.model, raw: hooked.raw } }));
  };

  // Join the shard's raid from wherever you are (components/game/fishing/RaidCall.tsx): its creature surfaces, then the reel.
  useEffect(() => {
    const onJoin = () => {
      const raid = raidNow(), raidFish = FISH.find(f => f.key === raid.fish);
      if (phaseRef.current !== "idle" || !raid.id || raid.result || !raidFish || !sendRaid({ op: "join", id: raid.id })) return;
      hookedRef.current = true;
      setFish(raidFish);
      setBossMode("shared");
      joinRaidAs(raid.id);
      changePhase("surfacing");
      window.dispatchEvent(new CustomEvent("tsi:boss-surface", { detail: { tier: "divine", at: { x: raid.x, z: raid.z } } }));
      timersRef.current.push(window.setTimeout(() => { if (phaseRef.current === "surfacing") changePhase("reeling"); }, HOOK.divine.surfaceMs));
    };
    window.addEventListener("tsi:raid-join", onJoin);
    return () => window.removeEventListener("tsi:raid-join", onJoin);
  }, [changePhase]);

  /** Into the bag: as the catch's card closes if it is still up (cancel), else now. */
  const intoBag = (key: string) => {
    if (phaseRef.current === "revealing") pendingBagRef.current = key;
    else window.dispatchEvent(new CustomEvent("tsi:bag-got", { detail: { key } }));
  };

  /** Reel finished. Success → collect + the catch card; fail → it got away. */
  const onReelDone = useCallback(
    (success: boolean) => {
      clearTimers();
      if (success && fish) {
        // Every catch, first or repeat, gets the cozy card (FishReveal) after the world's beat; the camera leans in on
        // you and the fish (in your hands, or over your head) while it's up, and the catch shakes it as it comes out.
        changePhase("revealing");
        shakeCamera(catchShake(fish.rarity));
        setAimZoom(REVEAL_ZOOM);
        const isNew = !ownedRef.current.has(fish.key);
        ownedRef.current.add(fish.key);
        setWasNew(isNew);
        const landing = landRef.current;
        // A server roll shows the size it records (none off the roster); the local demo rolls its own.
        const size = landing ? landing.size : rollSize(fish.sizeCm);
        setCaughtSize(size);
        setNewRecord(false);
        setLearned(null);
        // Signals the "catch a fish" onboarding quest (auto-complete).
        // zone + spot coords ride along for world reactions (gull swoop).
        window.dispatchEvent(
          new CustomEvent("tsi:fish-caught", {
            detail: { key: fish.key, model: fish.model, raw: fish.raw, sizeCm: size, zone: fish.zone ?? "river", x: spotRef.current?.x, z: spotRef.current?.z, boss: bossMode !== null },
          })
        );
        // A raid's catch is claimed with the room's signed credit (none without a server: kept here); a cast's, by its roll.
        const credit = raidIdRef.current ? raidNow().credit : undefined;
        const claim = raidIdRef.current ? (credit ? claimRaid(credit) : null) : landing ? landCatch(landing.roll) : null;
        if (collectionScope) collect(fish.key, { scope: collectionScope });
        else if (claim) {
          void claim.then(answer => {
            // Refused (the hourly cap, the bag filled since the cast): the card stands, the catch isn't kept.
            if (answer && !answer.ok) { bagFull(answer); window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: answer.error } })); return; }
            collect(fish.key);
            intoBag(fish.key);
            setLearned(answer?.catch.recipe?.name ?? null);
            const beat = localRecord(fish.key, size);
            setNewRecord(!isNew && (answer ? answer.catch.new_record === true && answer.catch.total_collected !== 1 : beat));
          });
        } else {
          collect(fish.key);
          intoBag(fish.key);
          setNewRecord(!isNew && localRecord(fish.key, size));
        }
      } else {
        changePhase("missed");
        window.dispatchEvent(new CustomEvent("tsi:fish-escaped", { detail: { hooked: true } })); // the line snaps
        timersRef.current.push(window.setTimeout(cancel, 1800));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fish, collectionScope, bossMode]
  );

  useEffect(() => bindFishingCastLifecycle({
    getPhase: () => phaseRef.current,
    onStart: (spot) => {
      spotRef.current = spot;
      releaseRequestedRef.current = false;
      setDevice(castDevice());
      changePhase("charging");
    },
    onRelease: () => { releaseRequestedRef.current = true; },
    onCancel: cancel,
    heldInput: reelInputRef.current,
  }), [cancel, changePhase]);

  // Keyboard: E hooks during bite, ESC cancels (the reel and the reveal
  // each handle their own input). Capture so the world's E handler doesn't
  // also fire while fishing.
  useEffect(() => {
    if (phase === "idle" || phase === "reeling" || phase === "revealing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isGameControlTarget(document.activeElement)) return;
      if (e.key === "e" || e.key === "E" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        hook(e);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Left-click also hooks the bite (mouse-first flow into the hold-to-reel).
  // Capture + stop so nothing underneath fires.
  useEffect(() => {
    if (phase !== "bite") return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || isGameControlTarget(e.target as Element | null)) return;
      e.preventDefault();
      e.stopPropagation();
      hook(e);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => clearTimers(), []);

  return {
    phase, fish, caughtSize, wasNew, newRecord, learned, buddy, missNote, device, maxCast, bossMode, raidId, rod,
    /** Species this player has caught (a first catch shows ??? on the reel). */
    owned: ownedRef.current,
    /** The input held from the hook into the reel. */
    reelInput: reelInputRef.current,
    releaseRequestedRef, castNow, cancel, onReelDone,
    /** How long the card waits for the world's beat (a boss's landing takes longer). */
    revealDelay: bossMode ? BOSS_REVEAL_DELAY_MS : REVEAL_DELAY_MS,
  };
}
