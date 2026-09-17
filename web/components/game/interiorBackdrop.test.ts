import { expect, it } from "vitest";
import { Color, Fog, Scene } from "three";
import { applyInteriorBackdrop } from "./interiorShared";

it("restores the existing world when an interior overlay closes", () => {
  const scene = new Scene();
  const background = new Color("#c7e0df"), fog = new Fog(background, 15, 57);
  scene.background = background; scene.fog = fog;
  const close = applyInteriorBackdrop(scene);
  expect(scene.fog).toBeNull();
  close();
  expect(scene.background).toBe(background);
  expect(scene.fog).toBe(fog);
});

it("does not overwrite the new exterior attached before interior cleanup", () => {
  const scene = new Scene();
  const close = applyInteriorBackdrop(scene);
  const background = new Color("#ddd5cc"), fog = new Fog(background, 14, 53);
  scene.background = background; scene.fog = fog;
  close();
  expect(scene.background).toBe(background);
  expect(scene.fog).toBe(fog);
});
