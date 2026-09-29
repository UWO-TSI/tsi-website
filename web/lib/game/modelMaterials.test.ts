import { expect, it, vi } from "vitest";
import { BoxGeometry, FrontSide, Frustum, Group, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Texture, Vector3 } from "three";
import { disposeModelMaterials, lightHQWindows, lookClassFor, prepareModel, tagLookClasses } from "./modelMaterials";
import { bendViewPoint } from "./worldProjection";

it("lights only instance-owned HQ glass while preserving frames and cached textures", () => {
  const texture = new Texture();
  const glass = new MeshStandardMaterial({ name: "mWindowL", map: texture, emissiveMap: texture });
  const wall = new MeshStandardMaterial({ name: "mWall", map: texture, emissiveMap: texture });
  const source = new Mesh(new BoxGeometry(), [glass, wall]);
  const clone = prepareModel(source, "/assets/acnh/buildings/hq-office.glb") as Mesh<BoxGeometry, MeshStandardMaterial[]>;
  lightHQWindows(clone, "#ffc95a");
  expect(clone.material[0].map).toBeNull();
  expect(clone.material[0].emissiveMap).toBeNull();
  expect(clone.material[0].emissive.getHexString()).toBe("ffc95a");
  expect(clone.material[1].map).toBe(texture);
  expect(clone.material[1].emissiveMap).toBe(texture);
  expect(glass.map).toBe(texture);
  expect(glass.emissive.getHex()).toBe(0);
  disposeModelMaterials(clone);
  source.geometry.dispose(); glass.dispose(); wall.dispose(); texture.dispose();
});

it("keeps source materials intact and disposes only the instance's shared clones", () => {
  const texture = new Texture();
  const material = new MeshStandardMaterial({ name: "mTreeOakLeaf", map: texture });
  const geometry = new BoxGeometry();
  const source = new Group();
  source.add(new Mesh(geometry, material), new Mesh(geometry, [material, material]));
  const originalDispose = vi.spyOn(material, "dispose");
  const geometryDispose = vi.spyOn(geometry, "dispose");
  const textureDispose = vi.spyOn(texture, "dispose");
  const clone = prepareModel(source, "/assets/acnh/plants/tree-hardwood-a.glb");
  const first = clone.children[0] as Mesh<BoxGeometry, MeshStandardMaterial>;
  const second = clone.children[1] as Mesh<BoxGeometry, MeshStandardMaterial[]>;
  expect(first.material).not.toBe(material);
  expect(second.material).toEqual([first.material, first.material]);
  expect(first.material.map).toBe(texture);
  expect(material.color.getHex()).toBe(0xffffff);
  expect(first.material.color.g).toBeGreaterThan(first.material.color.r);
  const cloneDispose = vi.spyOn(first.material, "dispose");
  disposeModelMaterials(clone);
  expect(cloneDispose).toHaveBeenCalledOnce();
  expect(originalDispose).not.toHaveBeenCalled();
  expect(geometryDispose).not.toHaveBeenCalled();
  expect(textureDispose).not.toHaveBeenCalled();
});

it("keeps a curved-world model visible when its unbent bounds are above the view", () => {
  const camera = new PerspectiveCamera(48, 2, 0.1, 300);
  camera.position.set(0, 19.5, -35);
  camera.lookAt(0, 1.5, -15);
  camera.updateMatrixWorld();
  const source = new Mesh(new BoxGeometry(6.76, 3.89, 3.42), new MeshStandardMaterial());
  source.position.set(0, 5, 30);
  source.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  expect(frustum.intersectsObject(source)).toBe(false);
  const drawn = bendViewPoint(new Vector3(0, 5, 30).applyMatrix4(camera.matrixWorldInverse)).applyMatrix4(camera.projectionMatrix);
  expect(Math.abs(drawn.y)).toBeLessThan(1);
  const prepared = prepareModel(source, "/assets/acnh/buildings/oracle-museum.glb");
  expect(prepared.frustumCulled).toBe(false);
  expect(source.frustumCulled).toBe(true);
  disposeModelMaterials(prepared);
  source.material.dispose();
  source.geometry.dispose();
});

it("changes mapped lamp glow per instance without lighting glass or mutating the cache", () => {
  const body = new MeshStandardMaterial({ emissive: "white", emissiveMap: new Texture() });
  const glass = new MeshStandardMaterial({ transparent: true, opacity: 0.4 });
  const source = new Mesh(new BoxGeometry(), [body, glass]);
  const day = prepareModel(source, "/assets/acnh/props/streetlamp.glb", 0) as Mesh<BoxGeometry, MeshStandardMaterial[]>;
  const night = prepareModel(source, "/assets/acnh/props/streetlamp.glb", 2.2) as Mesh<BoxGeometry, MeshStandardMaterial[]>;
  expect(day.material[0].emissiveIntensity).toBe(0);
  expect(night.material[0].emissiveIntensity).toBe(2.2);
  expect(body.emissiveIntensity).toBe(1);
  expect(night.material[1].emissiveIntensity).toBe(1);
  expect(night.material[1].opacity).toBe(0.4);
  disposeModelMaterials(day);
  expect(night.material[0].emissiveMap).toBe(body.emissiveMap);
  disposeModelMaterials(night);
  body.emissiveMap?.dispose();
  body.dispose();
  glass.dispose();
  source.geometry.dispose();
});


it("keeps repaired glass transparent and out of the opaque shadow pass", () => {
  for (const prop of ["streetlamp", "park-clock"]) {
    const glass = new MeshStandardMaterial({ name: "mGlassF", transparent: true, opacity: 0.4 });
    const source = new Mesh(new BoxGeometry(), glass);
    const clone = prepareModel(source, `/assets/acnh/props/${prop}.glb`) as Mesh<BoxGeometry, MeshStandardMaterial>;
    expect(clone.castShadow).toBe(false);
    expect(clone.material.side).toBe(FrontSide);
    expect(clone.material.depthWrite).toBe(false);
    expect(glass.depthWrite).toBe(true);
    disposeModelMaterials(clone);
    source.geometry.dispose();
    glass.dispose();
  }
});

it("applies the shadow class: ACNH tree casters cast depth only, leaf cards stop casting and receiving (row 240)", () => {
  const part = (name: string) => new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name }));
  const source = new Group();
  source.add(part("mShadow"), part("mShadowShake"), part("mTreeOakLeaf"), part("mPltTreeOakTrunk"));
  const oak = prepareModel(source, "/assets/acnh/plants/tree-hardwood-a.glb");
  const [hull, sway, leaf, trunk] = oak.children as Mesh[];
  for (const caster of [hull, sway]) {
    expect(caster.castShadow).toBe(true);
    expect(caster.receiveShadow).toBe(false);
    expect(caster.visible).toBe(false);
    expect((caster.material as MeshBasicMaterial).colorWrite).toBe(false);
  }
  expect(sway.userData.sunCaster).toBe("dynamic");
  expect(sway.customDepthMaterial).toBeDefined();
  expect(hull.userData.sunCaster).toBeUndefined();
  expect([leaf.castShadow, leaf.receiveShadow, leaf.visible]).toEqual([false, false, true]);
  expect([trunk.castShadow, trunk.receiveShadow]).toEqual([false, true]);
  disposeModelMaterials(oak);
  // Foliage without ACNH casters casts its outline (front faces) and never shades itself.
  const bush = prepareModel(part("PltBushHolly__PltBushHolly4_mat0"), "/assets/acnh/plants/bush-holly.glb") as Mesh<BoxGeometry, MeshStandardMaterial>;
  expect([bush.castShadow, bush.receiveShadow, bush.material.shadowSide]).toEqual([true, false, FrontSide]);
  // Small things receive only; an override wins over the URL.
  const flower = prepareModel(part("PltFlwRose__PltFlwRose2_mat0"), "/assets/acnh/plants/flower-rose.glb");
  expect([flower.castShadow, flower.receiveShadow]).toEqual([false, true]);
  const lantern = prepareModel(part("mReBody"), "/assets/acnh/props/stone-lantern.glb", undefined, "none");
  expect(lantern.castShadow).toBe(false);
  for (const m of [bush, flower, lantern]) disposeModelMaterials(m);
});

it("classes outdoor glass and metal for reflections (row 237) and leaves characters, interiors, wood and fabric alone", () => {
  const A = "/assets/acnh/", G = "/assets/game/";
  // Glass: building windows, lamp globes, the clock dome, the outdoor fitting-room mirror, the message bottle.
  for (const [url, name] of [[`${A}buildings/hq-office.glb`, "mWindowL"], [`${A}buildings/hq-office.glb`, "mSideWindow"], [`${A}buildings/chalet-wall-a.glb`, "mWindowGlass"],
    [`${A}buildings/shop-market.glb`, "mRoofWindow"], [`${A}buildings/shop-market-door.glb`, "mWindow"], [`${A}props/streetlamp.glb`, "mGlassF"], [`${A}props/park-clock.glb`, "mGlass"],
    [`${A}furniture/fitting-room.glb`, "mMirror"], [`${G}props/message-bottle.glb`, "M_Glass"]]) expect(lookClassFor(url, name), `${url} ${name}`).toBe("glass");
  // Metal: lamp post, clock post, mailbox, workbench fittings, the weapons' blades and brass.
  for (const [url, name] of [[`${A}props/streetlamp.glb`, "mReBody"], [`${A}props/park-clock.glb`, "mReBody"], [`${A}furniture/mailbox.glb`, "mBody"],
    [`${G}props/workbench.glb`, "M_Iron"], [`${G}props/workbench.glb`, "M_Steel"], [`${G}weapons/sword-iron.glb`, "M_Blade"], [`${G}weapons/sword-iron.glb`, "M_Brass"],
    [`${G}weapons/revolver-brass.glb`, "M_Drum"], [`${G}weapons/staff-rune.glb`, "M_Brass"]]) expect(lookClassFor(url, name), `${url} ${name}`).toBe("metal");
  // Unchanged: walls, wood, fabric, grips, the driftwood sword, interior furniture glass, character accessories and outfits.
  for (const [url, name] of [[`${A}buildings/hq-office.glb`, "mWall"], [`${A}props/bench-park.glb`, "mReBody"], [`${A}furniture/fitting-room.glb`, "mReFabric"],
    [`${G}weapons/sword-iron.glb`, "M_Grip"], [`${G}weapons/sword-driftwood.glb`, "M_Blade"], [`${A}furniture/museum-case.glb`, "mGlass"], [`${A}furniture/wall-clock.glb`, "mGlass"],
    [`${A}furniture/weapon-sword.glb`, "mReBody"], ["/assets/characters/v6/accessories/accessory/acc_glasses_round.glb", "M_Main"],
    ["/assets/characters/v6/outfits/onepiece/outfit_koi_kimono.glb", "M_Gold"]]) expect(lookClassFor(url, name), `${url} ${name}`).toBe("props");
  expect(lookClassFor(`${A}plants/tree-hardwood-a.glb`, "mGlass")).toBe("foliage");
});

it("tags prepared clones and held weapons with their look class", () => {
  const blade = new MeshStandardMaterial({ name: "M_Blade" }), grip = new MeshStandardMaterial({ name: "M_Grip" });
  const weapon = tagLookClasses(new Mesh(new BoxGeometry(), [blade, grip]), "/assets/game/weapons/sword-iron.glb");
  expect([blade.userData.lookClass, grip.userData.lookClass]).toEqual(["metal", "props"]);
  const lamp = prepareModel(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: "mReBody" })), "/assets/acnh/props/streetlamp.glb") as Mesh<BoxGeometry, MeshStandardMaterial>;
  expect(lamp.material.userData.lookClass).toBe("metal");
  disposeModelMaterials(lamp);
  weapon.geometry.dispose(); blade.dispose(); grip.dispose();
});
