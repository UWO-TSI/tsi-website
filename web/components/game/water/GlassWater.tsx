"use client";

/**
 * Glass water's switch for the scene (v1 water item 5): on with High and the player's "Glass water" toggle (Settings),
 * never on Lite; the world bench can switch it off to price it (`glassWater`). Off, the bed, the seabed's props and
 * the fish draw without the refraction wobble.
 */
import { useEffect } from "react";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { glassWaterOn } from "@/lib/game/graphicsSettingsStore";
import { FX_BENCH, useFxBench } from "@/lib/game/perf/fxBench";
import { GLASS_ON } from "../grid/terrainMaterials";

export default function GlassWater() {
  const [graphics] = useGraphicsSettings();
  const fx = useFxBench();
  const on = glassWaterOn(graphics) && !(FX_BENCH && fx.off.has("glassWater"));
  useEffect(() => {
    GLASS_ON.value = on ? 1 : 0;
    return () => { GLASS_ON.value = 0; };
  }, [on]);
  return null;
}
