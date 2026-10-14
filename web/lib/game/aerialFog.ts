"use client";

/**
 * Aerial-perspective fog (lighting research L8, 2026-07-14).
 *
 * Real distance haze desaturates BEFORE it tints — stylized games fake
 * depth with "layered color + gradient fog, cooling and desaturating
 * with distance" (Firewatch/BotW notes in specs/lighting-research.md).
 * Three's stock fog only lerps toward fogColor, which keeps distant
 * grass fully saturated under the haze and reads flat.
 *
 * Same mechanism as curvedWorld.ts: patch the shared `fog_fragment`
 * chunk once, before any material compiles — every fogged built-in
 * material (terrain, props, ocean via its Basic material) picks it up.
 * Desaturation is scaled by the SAME fogFactor, so near objects are
 * untouched and the effect fades in exactly with the haze.
 */

import * as THREE from "three";

// 0.35 → 0.18 (David report 2026-07-23: fog made colors read "weird" —
// the wash was strongest at night where the indigo tint stacked on the
// desat and greyed the whole midground). 0.18 keeps the layered-depth
// read without the milk.
const DESAT = 0.18; // fraction of full grayscale at fogFactor = 1

/**
 * Atmospheric haze (v1 land pass, specs/v1-drop.md §8c, ref water-clarity-palette-ref.png): a thin veil of the fog's
 * own colour that thickens gently from under half the fog's start, so the middle distance already sits a little back
 * (about 9% at 25 u, 23% at 50 u on the day look) before the fog proper closes the far edge. It never thins the fog:
 * the stronger of the two wins. Its colour is the look's fog, so dawn, golden hour, night, the approved overcast and
 * the seasons tint it as they tint the fog.
 */
export const HAZE = { start: 0.45, rate: 2.2, max: 0.32 };

const MARKER = "// tsi-aerial-fog";

if (typeof window !== "undefined") {
  const chunk = THREE.ShaderChunk.fog_fragment;
  if (!chunk.includes(MARKER)) {
    THREE.ShaderChunk.fog_fragment = chunk.replace(
      "gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );",
      `${MARKER}
#ifndef FOG_EXP2
  fogFactor = max( fogFactor, ${HAZE.max.toFixed(2)} * ( 1.0 - exp( - max( vFogDepth - fogNear * ${HAZE.start.toFixed(2)}, 0.0 ) / max( fogFar - fogNear, 1.0 ) * ${HAZE.rate.toFixed(2)} ) ) );
#endif
gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( dot( gl_FragColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) ), fogFactor * ${DESAT.toFixed(2)} );
gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );`
    );
  }
}
