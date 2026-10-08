/**
 * Per-frame work counters (specs/perf/): a few integer increments a frame, read and cleared once a frame by the perf
 * probe (components/game/PerfProbe.tsx). Characters count their mixer steps here; the probe counts skeleton uploads.
 */
export const frameStats = {
  /** Character mixers stepped this frame (Puppet.update with a motion). */
  mixers: 0,
  /** Skeletons whose bone matrices were recomputed and uploaded this frame (one per skinned character drawn). */
  skeletons: 0,
  /** Characters drawing their LOD 1 mesh this frame, and those whose mixer runs below every frame (lod.ts). */
  lodMeshes: 0,
  throttled: 0,
};
