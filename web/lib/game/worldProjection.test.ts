import { describe, expect, it } from "vitest";
import { Object3D, PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { bendViewPoint, calculateCurvedHtmlPosition, pickCurvedSurface } from "./worldProjection";

describe("curved world projection", () => {
  it("puts a DOM label at the same pixel as its bent mesh", () => {
    const camera = new PerspectiveCamera(48, 1.6, 0.1, 150);
    camera.position.set(8, 13, -20);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const object = new Object3D();
    object.position.set(3, 2, 4);
    object.updateMatrixWorld();
    const point = object.position.clone().applyMatrix4(camera.matrixWorldInverse);
    point.y -= point.z ** 2 * 0.0032 + point.x ** 2 * 0.0011;
    point.applyMatrix4(camera.projectionMatrix);
    const pixel = calculateCurvedHtmlPosition(object, camera, { width: 1600, height: 1000 });
    expect(pixel[0]).toBeCloseTo((point.x + 1) * 800);
    expect(pixel[1]).toBeCloseTo((1 - point.y) * 500);
  });
  it("inverts the bend and supports a flat survey view", () => {
    const point = new Vector3(9, 4, -28);
    expect(bendViewPoint(bendViewPoint(point.clone()), true).distanceTo(point)).toBeLessThan(1e-10);
    expect(bendViewPoint(point.clone(), false, 0, 0)).toEqual(point);
  });
  it.each([[0, 13, -20], [12, 21, -27], [-15, 16, 9]])("picks the visible ground with camera at %j", (x, y, z) => {
    const camera = new PerspectiveCamera(48, 1.6, 0.1, 150);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const target = new Vector3(3, 0.7, 4);
    const ndc = bendViewPoint(target.clone().applyMatrix4(camera.matrixWorldInverse)).applyMatrix4(camera.projectionMatrix);
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
    const hit = pickCurvedSurface(raycaster.ray, camera, () => 0.7);
    expect(hit).not.toBeNull();
    expect(hit!.distanceTo(target)).toBeLessThan(0.004);
  });
});
