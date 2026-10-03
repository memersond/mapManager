# Buildings

## Definitions (`src/buildings/buildings.ts`)
- `BUILDING_DEFS` — sprite, footprint (`width`/`height` in tiles), `cost`, `costGrowth`, `requiresTerritory`, `territoryRange`. Order is the build menu order.
- Cost scales per building type: `cost * (1 + costGrowth) ^ builtCount`, rounded (`BuildingSystem.getCost`). City grows 20% per city.
- City: 2x2, `territoryRange` 30, `requiresTerritory: false` (so the first city can go anywhere). Every future building should set `requiresTerritory: true`.

## State (`src/buildings/BuildingSystem.ts`)
- Owns placed buildings, cell occupancy and the territory mask. Reset on `MAP_GENERATED`.
- `checkPlacement` returns a `PLACEMENT_ERROR` or null. Rules: in bounds, passable, unoccupied, no resource node, inside territory if required, affordable.
- `place` deducts the cost from [[Storage]], emits `BUILDING_PLACED`, and for buildings with a range claims territory and emits `TERRITORY_CHANGED`.

## Territory
- Range is a movement cost, not a radius: `cellsWithinCost` in `src/map/movement.ts` runs Dijkstra from the footprint cells. Entering a cell costs `step / movementSpeed` (step is 1, or √2 diagonally). Water is impassable and diagonals can't cut past impassable corners. See [[Map]].
- So territory reaches further over grass than over sand or stone, and stops at water.
- Territories from several cities are merged into one mask.
- `TerritoryRenderer` draws a faint fill (one pixel per cell texture, like the terrain) plus an outline along the territory edges. The outline width stays the same on screen at any zoom. Colors and alpha are constants at the top of the file.

## Placement (`src/buildings/BuildPlacement.ts`, `src/ui/BuildMenu.ts`)
- `BuildMenu` greys out buttons that can't be afforded (refreshed on storage, placement and map events) and deselects the active one if it becomes unaffordable. Tooltip shows the current scaled cost, red when unaffordable.
- `BuildMenu` (bottom-centre DOM bar) emits `BUILD_MODE_CHANGED` with the chosen def, or null to deselect.
- `BuildPlacement` shows a semi-transparent ghost centred on the cursor and tints it red when `checkPlacement` fails. Left click builds and leaves build mode; right click or Esc cancels.
