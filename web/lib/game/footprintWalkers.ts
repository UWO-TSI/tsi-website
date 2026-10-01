/**
 * Who leaves footprints besides the player (residents): their spot each frame, written by whoever moves them and read
 * by the snow prints (WeatherGround). Module state, no React; nothing per frame is allocated after a walker joins.
 */
export interface Walker { id: string; x: number; z: number; visible: boolean }
export const walkers = new Map<string, Walker>();
export function setWalker(id: string, x: number, z: number, visible: boolean): void {
  let w = walkers.get(id);
  if (!w) walkers.set(id, w = { id, x, z, visible });
  w.x = x; w.z = z; w.visible = visible;
}
export function dropWalker(id: string): void { walkers.delete(id); }
