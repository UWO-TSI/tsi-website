#!/usr/bin/env bash
# Re-extract every ACNH asset this project derives from the dump (M1, 2026-07-26).
#
# The pipeline that built the original public/assets/acnh/ files was never
# committed, so nobody could reproduce or fix it — and it had silently dropped
# meshes from 12 assets. This script IS the pipeline now. If an asset looks
# wrong, fix scripts/extract-acnh-kit.mjs and re-run this.
#
#   cd web && bash scripts/extract-acnh-all.sh
#   node scripts/extract-acnh-kit.mjs --audit    # verify afterwards
#
# Scale convention (enforced per line below, see bakeScale in the extractor):
#   plants/  -> --scale 0.1   assets ship WORLD-scale (NatureModels GLBProp
#                            passes scale ~1)
#   buildings/, props/ -> raw, because Building.tsx applies ACNH_SCALE = 0.1
#                         and prop call sites pass their own scale
#
# Only assets already derived from the dump are listed. Everything else in
# public/assets/acnh/ predates this script and is left alone.
set -euo pipefail
cd "$(dirname "$0")/.."
X="node scripts/extract-acnh-kit.mjs"

echo "── terrain autotile kits (raw; the grid renderer scales them) ──"
$X --kit FldUnitCliff            # 44 pieces -> cliff/
$X --kit FldUnitRiver            # 45 pieces -> river/
$X --kit FldUnitFall             # 47 pieces -> fall/

echo "── plants (world-scale) ──"
$X --kit PltTreeOakSakura --out plants --only PltTreeOak4Sakura --name tree-blossom     --scale 0.1
$X --kit PltTreeOak       --out plants --only PltTreeOak3       --name tree-hardwood-a  --scale 0.1
$X --kit PltTreeOak       --out plants --only PltTreeOak4       --name tree-hardwood-b  --scale 0.1

echo "── buildings (raw; composed from parts by Building.tsx) ──"
$X --kit StrcMuseumA02 --out buildings --only StrcMuseumA02      --name oracle-museum
$X --kit StrcOfficeA01 --out buildings --only StrcOfficeA01      --name hq-office
$X --kit StrcOfficeA01 --out buildings --only StrcOfficeA01Door0 --name hq-office-door
$X --kit StrcMarketA02 --out buildings --only StrcMarketA02      --name shop-market
$X --kit StrcMarketA02 --out buildings --only StrcMarketA02Door0 --name shop-market-door

# Chalet colourways = wall + roof pairings over one shared standard door.
$X --kit HouseWallPA04WoodframeA --out buildings --only HouseWallPA04WoodframeA --name chalet-wall-a
$X --kit HouseWallPA04WoodframeC --out buildings --only HouseWallPA04WoodframeC --name chalet-wall-c
$X --kit HouseWallPA04WoodframeE --out buildings --only HouseWallPA04WoodframeE --name chalet-wall-e
$X --kit HouseRoofPA04ThatchedB  --out buildings --only HouseRoofPA04ThatchedB  --name chalet-roof-b
$X --kit HouseRoofPA04ThatchedG  --out buildings --only HouseRoofPA04ThatchedG  --name chalet-roof-g
$X --kit HouseRoofPA04ThatchedE  --out buildings --only HouseRoofPA04ThatchedE  --name chalet-roof-e
$X --kit HouseDoorStandardBR     --out buildings --only HouseDoorStandardBR     --name chalet-door

echo "── props (raw) ──"
# BridgeWood05 / BridgeLog05: the 5-tile spans. Verified to match the
# dimensions of what shipped before (57.97 x 19.17 x 29.37 raw).
$X --kit BridgeWood --out props --only BridgeWood05 --name bridge-arch-wood
$X --kit BridgeLog  --out props --only BridgeLog05  --name bridge-arch-log

echo
echo "── audit ──"
$X --audit
