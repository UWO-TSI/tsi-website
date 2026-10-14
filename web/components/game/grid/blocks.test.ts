import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { terrainFixtureMap } from "@/lib/game/fixtures/terrainFixture";
import { villageOf } from "@/lib/game/villageMap";
import { CHUNK, cellToWorldX, cellToWorldZ } from "@/lib/game/grid";
import { terrainChunks } from "./GridTerrain";
import { TERRAIN_BLOCK, terrainBlocks } from "./terrainBlocks";
import { cliffBlocks, placementMatrix, type CliffPlacement } from "./cliffBlocks";
import { CurvedCull } from "@/lib/game/curvedCull";

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute("position").count) / 3;

describe("the ground by block", () => {
  const map = terrainFixtureMap(), v = villageOf(map, [{ id: "default", kind: "spawn", x: 0, z: -2 }]);

  it("draws every chunk's triangles, per layer, in fewer pieces", () => {
    const chunks = terrainChunks(map, v.field), sums = new Map<number, number>();
    for (const c of chunks) sums.set(c.surface, (sums.get(c.surface) ?? 0) + tris(c.geometry));
    const blocks = terrainBlocks(chunks, 2);
    const after = new Map<number, number>();
    for (const b of blocks) after.set(b.surface, (after.get(b.surface) ?? 0) + tris(b.geometry));
    expect(after).toEqual(sums);
    expect(blocks.length).toBeLessThan(chunks.length);
    for (const b of blocks) expect(b.geometry.boundingSphere).not.toBeNull();
  });

  it("keeps every piece inside its block", () => {
    const block = 2, span = CHUNK * block;
    for (const b of terrainBlocks(terrainChunks(map, v.field), block)) {
      const [, bx, bz] = b.key.split(":").map(Number), p = b.geometry.getAttribute("position");
      const x0 = cellToWorldX(map, bx * span) - 1, z0 = cellToWorldZ(map, bz * span) - 1;
      for (let i = 0; i < p.count; i += 7) {
        expect(p.getX(i)).toBeGreaterThanOrEqual(x0);
        expect(p.getX(i)).toBeLessThanOrEqual(x0 + span + 2);
        expect(p.getZ(i)).toBeGreaterThanOrEqual(z0);
        expect(p.getZ(i)).toBeLessThanOrEqual(z0 + span + 2);
      }
    }
    expect(TERRAIN_BLOCK).toBeGreaterThanOrEqual(1);
  });
});

describe("the cliff kit by block", () => {
  const map = terrainFixtureMap();
  /** A tiny kit file: a rock face with its own UVs and a grass top without any. */
  function kit() {
    const scene = new THREE.Group();
    const face = new THREE.BufferGeometry();
    face.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 10, 0, 0, 0, 15, 0], 3));
    face.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    face.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    face.setIndex([0, 1, 2]);
    const top = new THREE.BufferGeometry();
    top.setAttribute("position", new THREE.Float32BufferAttribute([0, 15, 0, 10, 15, 0, 0, 15, 10], 3));
    top.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    top.setIndex([0, 1, 2]);
    scene.add(new THREE.Mesh(face, new THREE.MeshStandardMaterial({ name: "mCliff" })), new THREE.Mesh(top, new THREE.MeshStandardMaterial({ name: "mGrass" })));
    return scene;
  }
  const rock = new THREE.MeshStandardMaterial({ name: "rock" }), grass = new THREE.MeshStandardMaterial({ name: "grass" });
  const at = (cx: number, cz: number, rotation: number): CliffPlacement => ({ x: cellToWorldX(map, cx), z: cellToWorldZ(map, cz), y: 0.75, rotation });

  it("bakes each placement where its instance stood, one mesh per material per block", () => {
    const placements = [at(1, 1, 0), at(2, 1, 1), at(40, 40, 3)];
    const meshes = cliffBlocks(map, ["a.glb"], [kit()], new Map([["a.glb", placements]]),
      own => ({ material: own.name === "mCliff" ? rock : grass, worldUv: own.name !== "mCliff" }), 0.5, 2);
    // Two blocks (cells 1-2 and cell 40), two materials.
    expect(meshes).toHaveLength(4);
    const near = meshes.filter(m => m.name.endsWith(":0:0"));
    const face = near.find(m => m.material === rock)!, top = near.find(m => m.material === grass)!;
    expect(tris(face.geometry)).toBe(2);
    // The second placement's first vertex: its instance matrix times the kit's.
    const want = new THREE.Vector3(0, 0, 0).applyMatrix4(placementMatrix(placements[1]));
    expect(new THREE.Vector3().fromBufferAttribute(face.geometry.getAttribute("position"), 3).distanceTo(want)).toBeLessThan(1e-5);
    // The rock keeps its own UVs; the grass top wears the ground's world UVs.
    expect(face.geometry.getAttribute("uv").getX(1)).toBe(1);
    const p = top.geometry.getAttribute("position"), uv = top.geometry.getAttribute("uv");
    expect(uv.getX(4)).toBeCloseTo(p.getX(4) * 0.5, 6);
    expect(uv.getY(4)).toBeCloseTo(p.getZ(4) * 0.5, 6);
    for (const m of meshes) { expect(m.receiveShadow).toBe(true); expect(m.castShadow).toBe(false); }
  });
});

describe("culling in the curved world", () => {
  const camera = new THREE.PerspectiveCamera(48, 1.6, 0.1, 120);
  camera.position.set(0, 10, 18);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const cull = new CurvedCull().update(camera), flat = new CurvedCull(0, 0).update(camera);
  const sphere = (x: number, y: number, z: number, r: number) => new THREE.Sphere(new THREE.Vector3(x, y, z), r);

  it("keeps what is in front, drops what is behind or past the far plane", () => {
    expect(cull.visible(sphere(0, 0, 0, 4))).toBe(true);
    expect(cull.visible(sphere(0, 0, 60, 4))).toBe(false);
    expect(cull.visible(sphere(0, 0, -200, 4))).toBe(false);
  });

  it("tests a box as three would off the top of the view, and never culls what the bend can bring into it", () => {
    const box = (x: number, y: number, z: number, h: number) => new THREE.Box3(new THREE.Vector3(x - h, y - 0.5, z - h), new THREE.Vector3(x + h, y + 0.5, z + h));
    expect(cull.visibleBox(box(0, 0, 0, 8))).toBe(true);
    expect(cull.visibleBox(box(0, 0, 60, 8))).toBe(false); // behind the camera
    expect(cull.visibleBox(box(200, 0, 0, 8))).toBe(false); // far off to the side
    expect(cull.visibleBox(box(0, -60, 0, 8))).toBe(false); // below the view
    expect(flat.visibleBox(box(0, 10, -60, 1))).toBe(false);
    expect(cull.visibleBox(box(0, 10, -60, 1))).toBe(true);
    // Every point of the box, bent, against the frustum: whenever any is in view, the box is kept.
    const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const p = new THREE.Vector3();
    for (let y = -10; y <= 40; y += 5) for (let z = -110; z <= 10; z += 10) {
      let seen = false;
      for (let i = 0; i <= 4 && !seen; i++) for (let j = 0; j <= 4 && !seen; j++) {
        p.set(-4 + 2 * i, y, z - 4 + 2 * j).applyMatrix4(camera.matrixWorldInverse);
        p.y -= p.z * p.z * 0.0032 + p.x * p.x * 0.0011;
        seen = f.containsPoint(p.applyMatrix4(camera.matrixWorld));
      }
      if (seen) expect(cull.visibleBox(new THREE.Box3(new THREE.Vector3(-4, y, z - 4), new THREE.Vector3(4, y, z + 4))), `${y},${z}`).toBe(true);
    }
  });

  it("keeps a far block above the view that the bend brings down into it", () => {
    // Above the top of the view 78 u out: outside the flat frustum (margin and all), sunk into view by the bend.
    const s = sphere(0, 10, -60, 1);
    expect(flat.visible(s)).toBe(false);
    expect(cull.visible(s)).toBe(true);
  });
});
