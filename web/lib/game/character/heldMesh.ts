/**
 * What a character holds (a tool, a weapon, the leaf, the bobber) drawn as one mesh per look class instead of one per
 * part (specs/perf/effects-cost.md: models in the hand were drawn part by part on every player in view, and each part
 * again in the sun's shadow map). Built once per GLB scene and shared: every copy is `template.clone(true)`, sharing
 * the geometry and materials.
 *
 * The item GLBs (art/props-enemies) are untextured parts that differ only in base colour, and in a glow on some: each
 * part's base colour is baked into its vertex colour (COLOR_0 × base colour, both linear, what three multiplies them
 * to) and its glow into an `aEmissive` attribute the merged material adds to its emission, so the parts of one look
 * class (props, metal, glass: LookMaterials patches those differently) with the same roughness and metalness draw as
 * one mesh. A tool, the leaf and the bobber are one mesh; a weapon one for its wood, cloth and glow and one for its
 * metal. A textured, transparent or cut-out part keeps its own material and merges only with parts that share it.
 *
 * `OffHand` (the classes v2 weapons' second part, which goes to the other hand) stays its own node with its own
 * merged meshes, so `holdOffHand` still finds and moves it. Anything skinned, morphed or multi-material is returned
 * unmerged (a plain clone).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { lookClassFor } from "../modelMaterials";

/** A node merged on its own, kept with its transform (Character.tsx holdOffHand). */
const BRANCH = "OffHand";
const TEXTURES = ["map", "emissiveMap", "normalMap", "bumpMap", "alphaMap", "aoMap", "lightMap", "roughnessMap", "metalnessMap", "displacementMap"] as const;

/** The breathing glow of a merged item's emissive parts (Character.tsx breathe): 1 at rest. Shared by every copy. */
export interface HeldGlow { value: number }

const templates = new WeakMap<THREE.Object3D, Map<string, THREE.Object3D>>();

/** The merged template for a GLB scene (cached per scene and url); clone it with `clone(true)` per holder. */
export function heldTemplate(scene: THREE.Object3D, url: string): THREE.Object3D {
  let byUrl = templates.get(scene);
  if (!byUrl) { byUrl = new Map(); templates.set(scene, byUrl); }
  let t = byUrl.get(url);
  if (!t) { t = mergeHeld(scene, url); byUrl.set(url, t); }
  return t;
}

/** The merged meshes' glow uniforms under `model` (empty when nothing glows). */
export function heldGlows(model: THREE.Object3D): HeldGlow[] {
  const out = new Set<HeldGlow>();
  model.traverse(o => { const g = ((o as THREE.Mesh).material as THREE.Material | undefined)?.userData?.heldGlow as HeldGlow | undefined; if (g) out.add(g); });
  return [...out];
}

const plain = (m: THREE.Material) => !TEXTURES.some(k => (m as unknown as Record<string, unknown>)[k]) && !m.transparent && !(m.alphaTest > 0);

/** Merge `scene` (not modified) into a new tree: the root and each OffHand node keep their transforms and hold merged meshes. */
export function mergeHeld(scene: THREE.Object3D, url: string): THREE.Object3D {
  let mergeable = true;
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh || Array.isArray(m.material) || m.geometry.groups.length > 1 || Object.keys(m.geometry.morphAttributes).length) mergeable = false;
  });
  if (!mergeable) return scene.clone(true);
  scene.updateMatrixWorld(true);
  const root = new THREE.Group();
  root.name = scene.name;
  root.position.copy(scene.position); root.quaternion.copy(scene.quaternion); root.scale.copy(scene.scale);
  root.userData = { ...scene.userData };
  const branches: { from: THREE.Object3D; to: THREE.Object3D }[] = [{ from: scene, to: root }];
  scene.traverse(o => {
    if (o === scene || o.name !== BRANCH) return;
    const node = new THREE.Group();
    node.name = o.name;
    // In the nearest branch's space above it (its home on the model): Character's holdOffHand reads and restores this matrix.
    const parent = branches.find(b => b.from === owner(o.parent!, branches))!;
    rel(o, parent.from).decompose(node.position, node.quaternion, node.scale);
    parent.to.add(node);
    branches.push({ from: o, to: node });
  });
  for (const b of branches) {
    const groups = new Map<string, { material: THREE.Material; parts: THREE.Mesh[] }>();
    b.from.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || owner(m, branches) !== b.from) return;
      const mat = m.material as THREE.Material, key = plain(mat) ? bakedKey(mat, url) : `own:${mat.uuid}`;
      const g = groups.get(key);
      if (g) g.parts.push(m); else groups.set(key, { material: mat, parts: [m] });
    });
    let i = 0;
    for (const [key, { material, parts }] of groups) {
      const baked = !key.startsWith("own:");
      const geometries = parts.map(p => partGeometry(p, rel(p, b.from), baked));
      const geometry = sameLayout(geometries) ? mergeGeometries(geometries) : null;
      if (!geometry) { for (const p of parts) { const c = p.clone(); rel(p, b.from).decompose(c.position, c.quaternion, c.scale); b.to.add(c); } continue; }
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, baked ? bakedMaterial(material, url, parts) : material);
      mesh.name = `${b.from.name || "held"}:${i++}`;
      b.to.add(mesh);
    }
  }
  return root;
}

/** The nearest branch a mesh sits under (an OffHand node, else the root). */
function owner(o: THREE.Object3D, branches: { from: THREE.Object3D }[]) {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (branches.some(b => b.from === p)) return p;
  return null;
}
/** `o`'s transform in `base`'s space. */
const rel = (o: THREE.Object3D, base: THREE.Object3D) => new THREE.Matrix4().copy(base.matrixWorld).invert().multiply(o.matrixWorld);

const emissiveOf = (m: THREE.Material) => {
  const s = m as THREE.MeshStandardMaterial;
  return s.emissive ? s.emissive.clone().multiplyScalar(s.emissiveIntensity ?? 1) : new THREE.Color(0, 0, 0);
};
/** Parts that can share one material once their colours are in the vertices: the look class and the shading. */
function bakedKey(m: THREE.Material, url: string) {
  const s = m as THREE.MeshStandardMaterial;
  return [m.type, lookClassFor(url, m.name), s.roughness, s.metalness, m.side, s.flatShading ? 1 : 0, s.envMapIntensity].join("|");
}

/** A part's geometry in its branch's space; baked: position, normal, colour (COLOR_0 × base colour) and emission only. */
function partGeometry(mesh: THREE.Mesh, m: THREE.Matrix4, baked: boolean): THREE.BufferGeometry {
  const src = mesh.geometry;
  let g: THREE.BufferGeometry;
  if (baked) {
    g = new THREE.BufferGeometry();
    const pos = src.getAttribute("position"), n = pos.count, mat = mesh.material as THREE.MeshStandardMaterial;
    g.setAttribute("position", pos.clone());
    const nor = src.getAttribute("normal");
    if (nor) g.setAttribute("normal", nor.clone());
    const base = src.getAttribute("color"), tint = mat.color ?? new THREE.Color(1, 1, 1), useBase = !!base && !!mat.vertexColors;
    const color = new Float32Array(n * 3), glow = new Float32Array(n * 3), e = emissiveOf(mat);
    for (let i = 0; i < n; i++) {
      color[i * 3] = (useBase ? base.getX(i) : 1) * tint.r;
      color[i * 3 + 1] = (useBase ? base.getY(i) : 1) * tint.g;
      color[i * 3 + 2] = (useBase ? base.getZ(i) : 1) * tint.b;
      glow[i * 3] = e.r; glow[i * 3 + 1] = e.g; glow[i * 3 + 2] = e.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(color, 3));
    g.setAttribute("aEmissive", new THREE.BufferAttribute(glow, 3));
    if (src.index) g.setIndex(src.index.clone());
  } else g = src.clone();
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  g.applyMatrix4(m);
  // A mirrored part: keep its faces' winding (and so its front side) as it was drawn.
  if (m.determinant() < 0) flipWinding(g);
  return g;
}
function flipWinding(g: THREE.BufferGeometry) {
  if (!g.index) g.setIndex(Array.from({ length: g.getAttribute("position").count }, (_, i) => i));
  const idx = g.index!;
  for (let t = 0; t + 2 < idx.count; t += 3) { const b = idx.getX(t + 1); idx.setX(t + 1, idx.getX(t + 2)); idx.setX(t + 2, b); }
}
/** mergeGeometries needs the same attributes everywhere and an index on all or none. */
function sameLayout(gs: THREE.BufferGeometry[]): boolean {
  const names = (g: THREE.BufferGeometry) => Object.keys(g.attributes).sort().join(",");
  const first = names(gs[0]);
  if (!gs.every(g => names(g) === first)) return false;
  if (gs.some(g => !!g.index) && gs.some(g => !g.index)) for (let i = 0; i < gs.length; i++) if (gs[i].index) gs[i] = gs[i].toNonIndexed();
  return true;
}

/**
 * The merged parts' material: the first part's, white, its colour from the vertices; any glow from `aEmissive` (times
 * `heldGlow`, which the tier-5 weapons breathe). Named as that part (its look class follows the name, modelMaterials
 * lookClassFor) and tagged with the class directly.
 */
function bakedMaterial(first: THREE.Material, url: string, parts: THREE.Mesh[]): THREE.Material {
  const m = first.clone() as THREE.MeshStandardMaterial;
  m.userData = { ...first.userData, lookClass: lookClassFor(url, first.name) };
  if (m.color) m.color.setRGB(1, 1, 1);
  m.vertexColors = true;
  const glows = parts.some(p => emissiveOf(p.material as THREE.Material).getHex() !== 0);
  if (m.emissive) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 1; }
  if (glows) {
    const glow: HeldGlow = { value: 1 };
    m.userData.heldGlow = glow;
    m.onBeforeCompile = shader => {
      shader.uniforms.uHeldGlow = glow;
      shader.vertexShader = "attribute vec3 aEmissive;\nvarying vec3 vHeldEmissive;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vHeldEmissive = aEmissive;");
      shader.fragmentShader = "uniform float uHeldGlow;\nvarying vec3 vHeldEmissive;\n" + shader.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vHeldEmissive * uHeldGlow;");
    };
    m.customProgramCacheKey = () => "held-glow-v1";
  }
  return m;
}
