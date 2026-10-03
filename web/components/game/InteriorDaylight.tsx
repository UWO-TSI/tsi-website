"use client";

/**
 * A room's daylight (specs/polish/interiors.md deliverable 3), from the island's light through lib/game/interiorLight:
 * the fill (cool daylight from the windows by day, the lamps' warmth at night), and the sun by day or the moon at
 * night falling through the windows. With shadows on, the shell's ceiling and cut-away wall cast (RoomShell), so the
 * light comes in only by the windows and lies on the floor in their shapes. `scale` is the room's own: the key at a
 * clear noon, the ambient and hemisphere strengths, and the half size of its shadow box.
 */
import { Color } from "three";
import { interiorLight } from "@/lib/game/interiorLight";
import type { IslandLight } from "@/lib/game/islandLighting";

const ca = new Color(), cb = new Color();
const mix = (x: string, y: string, t: number) => `#${ca.set(x).lerp(cb.set(y), t).getHexString()}`;

export default function InteriorDaylight({ light, scale, shadows = false, tint }: {
  light: IslandLight; shadows?: boolean;
  /** A room's own cast to its fill (the temple's lavender). */
  tint?: string;
  scale: { key: number; ambient: number; hemisphere: number; extent: number };
}) {
  const k = interiorLight(light);
  const p = light.sunPosition, len = Math.hypot(p[0], p[1], p[2]) || 1;
  const e = scale.extent;
  return <>
    <ambientLight color={tint ? mix(k.ambient.color, tint, 0.35) : k.ambient.color} intensity={scale.ambient * k.ambient.intensity} />
    <hemisphereLight color={tint ? mix(k.hemisphere.sky, tint, 0.3) : k.hemisphere.sky} groundColor={k.hemisphere.ground} intensity={scale.hemisphere * k.hemisphere.intensity} />
    <directionalLight color={k.key.color} intensity={scale.key * k.key.intensity} position={[p[0] / len * 16, p[1] / len * 16, p[2] / len * 16]}
      castShadow={shadows} shadow-mapSize={[2048, 2048]} shadow-radius={3} shadow-bias={-0.00015} shadow-normalBias={0.025}
      shadow-camera-left={-e} shadow-camera-right={e} shadow-camera-top={e} shadow-camera-bottom={-e} shadow-camera-near={0.5} shadow-camera-far={40} />
  </>;
}
