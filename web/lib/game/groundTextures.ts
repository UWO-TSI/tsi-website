/**
 * The ground's and the water's textures, as two sets (lane game/remodel-ground):
 *
 *   own   ours, painted procedurally by art/terrain/build_ground.py into assets/game/terrain/;
 *   dump  the ACNH dump's terrain, road and water files the grid terrain drew on main.
 *
 * The dump's files are Nintendo's, the largest surfaces on screen, and a takedown risk before the public launch. A world
 * draws our set when it opts in (`ownGround` on GridWorld and GridOcean, as `waves` opts in to the new sea); the
 * applicant island, live for recruits, keeps the dump's until David approves ours, and then one prop moves it over.
 */
export type GroundSet = "own" | "dump";
export const groundOf = (own: boolean | undefined): GroundSet => (own ? "own" : "dump");

export type GroundTexture =
  | "grassAlbedo" | "grassNormal" | "sand" | "snowGrain" | "cliff" | "fringeCliff" | "fringeRiver"
  | "soil" | "soilNormal" | "stone" | "stoneNormal" | "wood" | "woodNormal" | "brick" | "brickNormal"
  | "riverBed" | "seaRipple" | "seaGlint";

const ACNH = "/assets/acnh/", OWN = "/assets/game/terrain/";

/** Every texture's file per set. `grassAlbedo` null: the dump set's lawn wears the procedural quilt (lib/game/grassTexture.ts). */
export const GROUND_FILES: Record<GroundSet, Record<GroundTexture, string | null>> = {
  dump: {
    grassAlbedo: null,
    grassNormal: `${ACNH}terrain/mGrass_Nrm.png`,
    sand: `${ACNH}terrain/mSand_Alb.png`,
    snowGrain: `${ACNH}terrain/mSandSnow_Alb.png`,
    cliff: `${ACNH}terrain/mCliff_Alb.png`,
    fringeCliff: `${ACNH}terrain/mGrassCliffXlu.png`,
    fringeRiver: `${ACNH}terrain/mGrassRiverXlu.png`,
    soil: `${ACNH}road/mRoadSoil_Alb.png`,
    soilNormal: `${ACNH}road/mRoadSoil_Nrm.png`,
    stone: `${ACNH}road/mRoadStone_Alb.png`,
    stoneNormal: `${ACNH}road/mRoadStone_Nrm.png`,
    wood: `${ACNH}road/mRoadWood_Alb.png`,
    woodNormal: `${ACNH}road/mRoadWood_Nrm.png`,
    brick: `${ACNH}road/mRoadBrick_Alb.png`,
    brickNormal: `${ACNH}road/mRoadBrick_Nrm.png`,
    // Already ours (art/water/build_seabed.py).
    riverBed: "/assets/game/water/seabed-sand.webp",
    seaRipple: `${ACNH}terrain/mSeaWater_Nrm.png`,
    seaGlint: `${ACNH}textures/sea-glint.png`,
  },
  own: {
    grassAlbedo: `${OWN}grass-albedo.png`,
    grassNormal: `${OWN}grass-normal.png`,
    sand: `${OWN}sand-albedo.png`,
    snowGrain: `${OWN}snow-grain.png`,
    cliff: `${OWN}cliff-grain.png`,
    fringeCliff: `${OWN}fringe.png`,
    fringeRiver: `${OWN}fringe.png`,
    soil: `${OWN}soil-albedo.png`,
    soilNormal: `${OWN}soil-normal.png`,
    stone: `${OWN}stone-albedo.png`,
    stoneNormal: `${OWN}stone-normal.png`,
    wood: `${OWN}wood-albedo.png`,
    woodNormal: `${OWN}wood-normal.png`,
    brick: `${OWN}brick-albedo.png`,
    brickNormal: `${OWN}brick-normal.png`,
    riverBed: "/assets/game/water/seabed-sand.webp",
    seaRipple: `${OWN}sea-ripple.png`,
    seaGlint: `${OWN}sea-glint.png`,
  },
};

export const groundFile = (set: GroundSet, texture: GroundTexture): string | null => GROUND_FILES[set][texture];
