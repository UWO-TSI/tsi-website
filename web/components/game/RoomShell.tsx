"use client";

/**
 * The interior rooms' modelled shells (art/interiors/build_interiors.py; specs/polish/interiors.md deliverables 2-3):
 * walls with their panelling and trim, windows, the framed doorway in the cut-away near wall, and each room's own
 * fittings, as one GLB per room. Here they're prepared for the game: the panes show the outside for the time of day
 * (drawn from the island's blended light once a minute, looked at through the glass with a little depth), the ceiling
 * and the cut-away wall above the doorway cast shadows without being drawn (the sun comes in by the windows,
 * InteriorDaylight), and a click on the floor walks you there.
 */
import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { tagLookClasses } from "@/lib/game/modelMaterials";
import { AudioManager } from "@/lib/game/audio";
import { interiorLight } from "@/lib/game/interiorLight";
import { liveIslandWeather } from "@/lib/game/islandWeather";
import { seasonBlend } from "@/lib/game/season";
import { worldNow } from "@/lib/game/worldClock";
import type { IslandLight } from "@/lib/game/islandLighting";

export type ShellRoom = "hq" | "shop" | "oracle" | "museum";
export const shellUrl = (room: ShellRoom) => `/assets/game/interiors/${room}.glb`;
export const INTERIOR_KIT_URL = "/assets/game/interiors/kit.glb";
/** World units one repeat of the outside covers (build_interiors.py VIEW_TILE): y 0 to 6 bottom to top. */
const VIEW_TILE = 6;
/** How far behind the glass the outside seems to be: it slides past the window frames as you walk. */
const VIEW_DEPTH = 2.6;

// ── The outside, as the windows see it ────────────────────────────────────────────────────────────────────────────
const ca = new THREE.Color(), cb = new THREE.Color();
const mixHex = (x: string, y: string, t: number) => `#${ca.set(x).lerp(cb.set(y), Math.min(1, Math.max(0, t))).getHexString()}`;
const shade = (x: string, k: number) => `#${ca.set(x).multiplyScalar(k).getHexString()}`;
/** The far tree crowns through the glass, by season (winter's are under snow). */
const FAR_TREES = { spring: "#86ad70", summer: "#5f8f58", autumn: "#c08548", winter: "#c9d3da" } as const;

/**
 * One canvas for whichever room is showing: a lawn and hedge, tree crowns and far roofs softened into the haze, the
 * sky from the horizon colour up to the top colour, the low sun's glow, stars and a few lit windows at night, snow in
 * winter, rain or snow falling past the glass. Redrawn only when the light, the weather or the season changes.
 */
class OutsideView {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private key = "";
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 512; this.canvas.height = 512;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
  }
  draw(light: IslandLight) {
    const weather = liveIslandWeather(), season = seasonBlend(new Date(worldNow())), snowCover = season.weights.winter;
    const day = interiorLight(light).day;
    const key = `${light.sky}|${light.skyTop}|${light.fogColor}|${light.sun}|${day.toFixed(2)}|${weather}|${season.season}|${snowCover.toFixed(1)}`;
    if (key === this.key) return;
    this.key = key;
    const g = this.canvas.getContext("2d")!, S = 512, Y = (y: number) => S - (y / VIEW_TILE) * S;
    const horizon = mixHex(light.sky, light.fogColor, 0.35), top = light.skyTop ?? light.sky;
    const sky = g.createLinearGradient(0, Y(6), 0, Y(1.6));
    sky.addColorStop(0, top); sky.addColorStop(0.75, mixHex(top, horizon, 0.7)); sky.addColorStop(1, horizon);
    g.fillStyle = sky; g.fillRect(0, 0, S, S);
    // The low sun's glow along the horizon at dawn and dusk.
    const glow = Math.max(0, 1 - Math.abs(day - 0.5) * 2.2);
    if (glow > 0.02) {
      const sun = g.createLinearGradient(0, Y(3.6), 0, Y(1.7));
      sun.addColorStop(0, "rgba(0,0,0,0)"); sun.addColorStop(1, mixHex(light.sun, "#ffd9a8", 0.4));
      g.globalAlpha = 0.55 * glow; g.fillStyle = sun; g.fillRect(0, Y(3.6), S, Y(1.7) - Y(3.6)); g.globalAlpha = 1;
    }
    if (day < 0.5) {             // stars
      g.fillStyle = "#fff6dc";
      for (let i = 0; i < 70; i++) {
        const x = (i * 197.3) % S, y = Y(2.6 + ((i * 0.618) % 1) * 3.3);
        g.globalAlpha = (1 - day * 2) * (0.35 + ((i * 7) % 5) / 8);
        g.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
      }
      g.globalAlpha = 1;
    }
    // The far side: tree crowns and roofs in the haze; then the hedge, then the lawn up to the wall.
    const lawn = snowCover > 0.5 ? "#e8eef2" : "#8fb27c", night = 0.25 + 0.75 * day;
    const far = shade(mixHex(snowCover > 0.5 ? "#c9d3da" : FAR_TREES[season.season], light.fogColor, 0.45), night);
    const hedge = shade(snowCover > 0.5 ? "#b8c4c8" : "#557a4c", night * 0.95), ground = shade(mixHex(lawn, light.fogColor, 0.15), night);
    g.filter = "blur(3px)";
    g.fillStyle = far;
    for (let i = 0; i < 14; i++) { const x = (i * 41 + (i % 3) * 13) % (S + 40) - 20, r = 26 + ((i * 29) % 30); g.beginPath(); g.arc(x, Y(2.2 + ((i * 0.37) % 1) * 0.9), r, 0, Math.PI * 2); g.fill(); }
    g.fillRect(0, Y(2.3), S, Y(1.3) - Y(2.3));
    // Two far roofs between the trees.
    g.fillStyle = shade(mixHex("#a46a52", light.fogColor, 0.5), night);
    for (const x of [96, 352]) { g.beginPath(); g.moveTo(x - 34, Y(2.25)); g.lineTo(x, Y(2.75)); g.lineTo(x + 34, Y(2.25)); g.fill(); }
    g.fillStyle = shade(mixHex("#efe6d3", light.fogColor, 0.5), night);
    for (const x of [96, 352]) g.fillRect(x - 26, Y(2.25), 52, Y(1.8) - Y(2.25));
    g.filter = "blur(1.5px)";
    g.fillStyle = hedge;
    for (let i = 0; i < 22; i++) { const x = (i * 24.3) % S, r = 16 + ((i * 13) % 12); g.beginPath(); g.arc(x, Y(1.45 + ((i * 0.53) % 1) * 0.25), r, 0, Math.PI * 2); g.fill(); }
    g.fillRect(0, Y(1.4), S, Y(0.95) - Y(1.4));
    g.filter = "none";
    const lawnFill = g.createLinearGradient(0, Y(1.0), 0, S);
    lawnFill.addColorStop(0, shade(ground, 0.92)); lawnFill.addColorStop(1, ground);
    g.fillStyle = lawnFill; g.fillRect(0, Y(1.0), S, S - Y(1.0));
    if (day < 0.6) {             // lit windows in the far houses and a lamp or two
      g.fillStyle = "#ffcf7a";
      for (const [x, y] of [[88, 2.0], [104, 2.0], [344, 1.98], [360, 2.04], [212, 1.7], [470, 1.75]] as const) {
        g.globalAlpha = 1 - day / 0.6; g.shadowColor = "#ffb84d"; g.shadowBlur = 8;
        g.fillRect(x, Y(y), 5, 5);
      }
      g.globalAlpha = 1; g.shadowBlur = 0;
    }
    if (weather === "rain" || weather === "snow") {     // falling past the glass
      g.strokeStyle = weather === "rain" ? "rgba(225,235,245,0.45)" : "rgba(255,255,255,0.8)";
      g.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 120; i++) {
        const x = (i * 83.7) % S, y = (i * 151.3) % S;
        if (weather === "rain") { g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 18); g.stroke(); }
        else { g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
      }
    }
    this.texture.needsUpdate = true;
  }
}
let outside: OutsideView | null = null;
const outsideView = () => (outside ??= new OutsideView());

/** The panes: the outside texture, sampled where the view through the glass meets a plane VIEW_DEPTH behind it. */
let viewMaterial: THREE.MeshBasicMaterial | null = null;
function windowViewMaterial(): THREE.MeshBasicMaterial {
  if (viewMaterial) return viewMaterial;
  const m = new THREE.MeshBasicMaterial({ name: "WindowView", map: outsideView().texture });
  m.onBeforeCompile = shader => {
    shader.vertexShader = "varying vec3 vPaneWorld;\nvarying vec3 vPaneNormal;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
  vPaneWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vPaneNormal = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = "varying vec3 vPaneWorld;\nvarying vec3 vPaneNormal;\n" + shader.fragmentShader.replace("#include <map_fragment>", `{
    vec3 rd = normalize(vPaneWorld - cameraPosition);
    vec3 n = normalize(vPaneNormal);
    float facing = max(abs(dot(rd, n)), 0.12);
    vec3 hit = vPaneWorld + rd * (${VIEW_DEPTH.toFixed(2)} / facing);
    vec2 uvView = (abs(n.x) > abs(n.z) ? vec2(hit.z, hit.y) : vec2(hit.x, hit.y)) / ${VIEW_TILE.toFixed(1)};
    vec4 sampledDiffuseColor = texture2D(map, uvView);
    // A faint sheen of the glass itself, stronger as you look along it.
    sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.93, 0.96, 1.0), 0.06 + 0.14 * pow(1.0 - facing, 3.0));
    diffuseColor *= sampledDiffuseColor;
  }`);
  };
  m.customProgramCacheKey = () => "window-view-v1";
  return (viewMaterial = m);
}

/** Materials a room paints itself (the temple's banners and rose window, the museum's labels), by mesh name prefix. */
const ROOM_MATERIALS = new Map<string, () => THREE.Material>();
export function registerShellMaterial(prefix: string, make: () => THREE.Material) { ROOM_MATERIALS.set(prefix, make); }

const prepared = new WeakSet<THREE.Object3D>();
function prepareShell(scene: THREE.Object3D, url: string) {
  if (prepared.has(scene)) return;
  prepared.add(scene);
  tagLookClasses(scene, url);
  scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = mesh.name || mesh.parent?.name || "";
    if (/_caster/.test(name)) {
      // Shadow only (SunShadows draws it into the key light's map; the camera never sees it): the ceiling and the
      // cut-away wall above the doorway, so the sun or the moon comes in by the windows.
      mesh.material = new THREE.MeshBasicMaterial({ name: "Caster", side: THREE.DoubleSide, colorWrite: false, depthWrite: false });
      mesh.visible = false;
      mesh.castShadow = true;
      mesh.userData.casterOnly = true;
      return;
    }
    if (/_windows/.test(name)) { mesh.material = windowViewMaterial(); mesh.castShadow = false; mesh.receiveShadow = false; return; }
    for (const [prefix, make] of ROOM_MATERIALS) if (name.startsWith(prefix)) { mesh.material = make(); mesh.castShadow = false; mesh.receiveShadow = true; return; }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (m.transparent) m.depthWrite = false;
  });
}

/** A room's shell (a clone sharing the cached, prepared materials), and the meshes rooms dress further by name. */
export function useShell(room: ShellRoom): THREE.Object3D {
  const url = shellUrl(room);
  const { scene } = useGLTF(url);
  return useMemo(() => { prepareShell(scene, url); return scene.clone(true); }, [scene, url]);
}

/** The outside the windows show, kept to the island's light (once a minute) while a room is up. */
export function useOutside(light: IslandLight) {
  useEffect(() => { outsideView().draw(light); }, [light]);
}

/** A room's shell in place: a click on its floor walks you there. */
export function RoomShell({ room, light, children }: { room: ShellRoom; light: IslandLight; children?: React.ReactNode }) {
  const shell = useShell(room);
  useOutside(light);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.point.y > 0.3) return; // the walls and fittings, not the floor
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
    AudioManager.playSFX("click");
  };
  return <primitive object={shell} onClick={onClick}>{children}</primitive>;
}

/** The kit (curator's desk, the crystal, the home's lamp and near wall): one named node, a clone sharing materials. */
export function useKitPiece(node: string): THREE.Object3D {
  const { scene } = useGLTF(INTERIOR_KIT_URL);
  return useMemo(() => {
    prepareShell(scene, INTERIOR_KIT_URL);
    const part = scene.getObjectByName(node);
    if (!part) throw new Error(`kit.glb has no ${node}`);
    const clone = part.clone(true);
    clone.position.set(0, 0, 0);
    return clone;
  }, [scene, node]);
}

export function preloadShells(rooms: ShellRoom[]) {
  for (const r of rooms) useGLTF.preload(shellUrl(r));
  useGLTF.preload(INTERIOR_KIT_URL);
}
