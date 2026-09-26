/**
 * Clubhouse (HQ interior) layout, ported from the applicant island shipped on
 * main (`web/lib/game/applicantVillage.ts`, specs/clubhouse-refinement-2026-09-17.md).
 * Room walls are X ±8, Z ±6; the fixed camera sees +X on screen left.
 */
// Shared by rendered furniture, lighting, interaction anchors and collision.
function hqPiece(position: [number, number, number], scale: number, rotY: number, footprint?: [number, number]) {
  return { position, scale, rotY, footprint };
}
export const HQ_LAYOUT = {
  board: hqPiece([0, 1.28, 5.78], 0.2, Math.PI),
  sofa: hqPiece([4.85, 0, 4.8], 0.16, Math.PI, [1.47, 0.72]),
  table: hqPiece([4.85, 0, 2.85], 0.12, 0, [1.08, 0.55]),
  loungeChair: hqPiece([6.55, 0, 1.15], 0.1, -0.45, [0.55, 0.55]),
  loungeLamp: hqPiece([6.8, 0, 4.8], 0.115, 0, [0.36, 0.36]),
  desk: hqPiece([-5.2, 0, -2.4], 0.11, Math.PI, [1.2, 0.65]),
  deskChair: hqPiece([-5.2, 0, -0.7], 0.1, Math.PI, [0.45, 0.45]),
  shelf: hqPiece([7.7, 0, -1.3], 0.1, Math.PI / 2, [0.25, 1]),
  display: hqPiece([-4.5, 0, 5.2], 0.1, Math.PI, [1.5, 0.65]),
  clock: hqPiece([-7, 0, 5.55], 0.1, Math.PI, [0.45, 0.4]),
  monstera: hqPiece([-7.2, 0, 3.2], 0.1, 0, [0.55, 0.5]),
  yucca: hqPiece([7.25, 0, -4], 0.1, 0, [0.55, 0.5]),
};
export const HQ_CLOCK = HQ_LAYOUT.clock.position;
export const HQ_BOARD_APPROACH: [number, number] = [HQ_LAYOUT.board.position[0], 4.3];
export const HQ_PENDANTS = [
  { position: [0, 4, 5.65] as [number, number, number], scale: 0.05, drop: 0.78, power: 0.35 },
  { position: [HQ_LAYOUT.table.position[0], 4, HQ_LAYOUT.table.position[2]] as [number, number, number], scale: 0.07, drop: 1.09, power: 0.4 },
];

const HQ_FURNITURE = Object.values(HQ_LAYOUT).flatMap(piece => piece.footprint
  ? [[piece.position[0], piece.position[2], ...piece.footprint]] : []);
export function constrainClubhouse(x: number, z: number, nx: number, nz: number): [number, number] {
  const fits = (px: number, pz: number) => !HQ_FURNITURE.some(([cx, cz, w, d]) => Math.abs(px - cx) < w + 0.2 && Math.abs(pz - cz) < d + 0.2);
  const steps = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 0.15));
  const dx = (nx - x) / steps, dz = (nz - z) / steps;
  for (let i = 0; i < steps; i++) {
    if (fits(x + dx, z + dz)) { x += dx; z += dz; }
    else if (fits(x + dx, z)) x += dx;
    else if (fits(x, z + dz)) z += dz;
    else break;
  }
  return [x, z];
}
