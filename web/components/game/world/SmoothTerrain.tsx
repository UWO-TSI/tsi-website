"use client";

/**
 * The smooth world's ground in the scene (specs/world-editor.md v0 step 3): the chunked heightfield and its water
 * (TerrainView), the water's field baked from the real seabed, the ground height everything that asks terrain.ts reads,
 * and the grass blades where the paint is grass. GridWorld mounts it for a world with a heightfield in place of the
 * cell terrain, the cliff kit and the cliff-foot boulders; the editor mounts it with `onView` to edit the terrain.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { ShoreSdf } from "@/lib/game/grid";
import { terrainGrassSampler, terrainHeight, terrainShoreField, type WorldTerrain } from "@/lib/game/world/terrain";
import { setTerrainHeightProvider } from "../terrain";
import GrassField from "../grid/GrassField";
import { setShoreField } from "../grid/terrainMaterials";
import { SPLAT_COLORS } from "./splatMaterial";
import { TerrainView } from "./terrainView";
import type { SeaKind } from "@/lib/game/waterShader";

export default function SmoothTerrain({ terrain, shore, grass, windScale, lite = false, clear, onView, revision = 0, grassOn = true, sea = "waves" }: {
  terrain: WorldTerrain;
  /** The water's field (the village's, shared with the fish and the seabed props); baked here when absent. */
  shore?: ShoreSdf & { depth?: Float32Array };
  /** The season's grass colour. */
  grass?: string;
  windScale?: number;
  lite?: boolean;
  clear?: (x: number, z: number) => boolean;
  /** The view, for an editor that edits the terrain in place. */
  onView?: (view: TerrainView | null) => void;
  /** Bumped by an editor after editing: the grass resamples. */
  revision?: number;
  grassOn?: boolean;
  /** The world's sea (lib/game/waterShader.ts SeaKind): the v2 world and its editor opt in to the waves. */
  sea?: SeaKind;
}) {
  // Built with the placeholder grass; the season's colour is pushed below, never a rebuild.
  const editable = !!onView;
  const view = useMemo(() => new TerrainView(terrain, { editable, sea }), [terrain, editable, sea]);
  useEffect(() => () => view.dispose(), [view]);
  useEffect(() => { onView?.(view); return () => onView?.(null); }, [view, onView]);
  useEffect(() => { (view.material.userData.splat.uGrassC.value as { set: (c: string) => void }).set(grass ?? SPLAT_COLORS.grass); }, [view, grass]);
  // The water reads the real seabed: its distance to the shore and its depth, from the heights.
  useEffect(() => { setShoreField(shore ?? terrainShoreField(terrain)); }, [terrain, shore]);
  // Everything that asks terrain.ts for the ground (residents, click-to-move, the prop scatter) stands on the drawn surface.
  useEffect(() => {
    setTerrainHeightProvider((x, z) => terrainHeight(terrain, x, z));
    return () => setTerrainHeightProvider(null);
  }, [terrain]);
  const sampler = useMemo(() => terrainGrassSampler(terrain, clear), [terrain, clear]);
  useFrame(({ camera }) => view.frame(camera));
  return (
    <>
      <primitive object={view.group} />
      {grassOn && <GrassField sampler={sampler} color={grass ?? SPLAT_COLORS.grass} windScale={windScale} lite={lite} revision={revision} />}
    </>
  );
}
