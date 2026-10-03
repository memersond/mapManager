# Buildings

## Definitions (`src/buildings/buildings.ts`)
- `BUILDING_DEFS` — sprite, footprint (`width`/`height` in tiles), `area`, `cost`, `costGrowth`, `requiresTerritory`, `territoryRange`, `allowedTerrain`, `requiredResource`, `clearsResources`, `repeatPlacement`, `maintenance` (items per tick), `startingPopulation`, `jobs`, `production` (items per worker per tick), `storesGoods`, `maxHaulers`, `defaultHaulers`. Order is the build menu order.
- Cost scales per building type: `cost * (1 + costGrowth) ^ builtCount`, rounded (`BuildingSystem.getCost`). Queued buildings count, and cost is locked in at placement. City grows 20% per city. Area buildings pay `cost` per cell.
- `area` makes a building drag-sized: `width`/`height` become the minimum, `area.maxWidth`/`maxHeight` the maximum.
- `jobs` (`JobRule`) sets the workers a building can employ, fixed at placement:
  - `richness` — `floor(node amount / richnessPerWorker)`, clamped to `[min, max]`.
  - `area` — `ceil(cells / cellsPerWorker)`, so a 1x1 farm still has a job.
- Producers:
  - Farm — drag 1x1 to 10x10, grass only, clears trees/ore under it (`RESOURCES_CLEARED`), 2 wood per tile, 1 worker per 4 tiles (rounded up), 0.3 food/worker.
  - Woodcutter — 1x1 on a tree, 1 worker per 50 richness (1–6), 0.25 wood/worker.
  - Mine — 1x1 on ore, 1 worker per 100 richness (1–8), 0.1 ore/worker.
  - Resource nodes are not depleted yet.
- City: 2x2, `territoryRange` 30, `requiresTerritory: false` (so the first city can go anywhere), `storesGoods`, 0.5 wood/tick maintenance, 20 starting population, up to 20 haulers. Completing the first city starts the clock ([[Time]]). Every future building should set `requiresTerritory: true`.
- Producers take up to 8 haulers. See [[Logistics]].

## State (`src/buildings/BuildingSystem.ts`)
- Owns placed buildings, cell occupancy and the territory mask. Reset on `MAP_GENERATED`.
- Placement works on a `Rect` (`x`, `y`, `width`, `height`); `defaultRect` gives a def's normal footprint.
- `checkPlacement` returns a `PLACEMENT_ERROR` or null. Rules: valid size, in bounds, passable, unoccupied, allowed terrain, required resource on every cell (or no resource unless `clearsResources`), inside territory if required, affordable.
- Each `Building` stores its rect, `name` (cities are numbered), `status` (`queued` / `complete`), locked `cost`, `jobs`, `workers` and `haulers` (assigned by [[Economy]]) and its own `storage`.
- `place` queues the building and emits `BUILDING_PLACED`. `complete` (called by `ConstructionSystem` once paid, see [[Logistics]]) sets population, clears resources under `clearsResources` footprints (`RESOURCES_CLEARED`), emits `BUILDING_COMPLETED`, and for buildings with a range claims territory and emits `TERRITORY_CHANGED`. `cancel` removes a queued building (`BUILDING_CANCELLED`).
- Only the first city must be affordable from the starting supplies (`CANNOT_AFFORD`); later buildings queue until their city has the goods. `UNREACHABLE` if no city can reach the site.
- `BuildingRenderer` draws queued buildings faded.
- `BuildingSelection` — left click on a building (outside build mode) emits `BUILDING_SELECTED` `{ building }` and outlines it; empty ground or Esc emits null.

## Territory
- Range is a movement cost, not a radius: `cellsWithinCost` in `src/map/movement.ts` runs Dijkstra from the footprint cells. Entering a cell costs `step / movementSpeed` (step is 1, or √2 diagonally). Water is impassable and diagonals can't cut past impassable corners. See [[Map]].
- So territory reaches further over grass than over sand or stone, and stops at water.
- Territories from several cities are merged into one mask.
- `TerritoryOverlay` draws any cell mask as a faint fill (one pixel per cell texture, like the terrain) plus an outline along its edges. The outline width stays the same on screen at any zoom. Style (colors, alpha, depth) is passed in.
- `TerritoryRenderer` uses it for the claimed territory (style at the top of the file).

## Placement (`src/buildings/BuildPlacement.ts`, `src/ui/BuildMenu.ts`)
- `BuildMenu` greys out buttons that can't be afforded (only possible before the first city) (refreshed on storage, placement and map events) and deselects the active one if it becomes unaffordable. Tooltip shows the current scaled cost, red when unaffordable.
- `BuildMenu` (bottom-centre DOM bar) emits `BUILD_MODE_CHANGED` with the chosen def, or null to deselect.
- `BuildPlacement` shows a semi-transparent ghost whose top-left is the hovered tile (same `floor` as `TileHover`) and tints it red when `checkPlacement` fails.
- For buildings with a range it also previews the territory that building alone would claim (`BuildingSystem.previewTerritory`) as a white `TerritoryOverlay`. Recomputed only when the hovered tile changes. No preview when the footprint is out of bounds or impassable.
- Area buildings: press left to anchor, drag to size (clamped to min/max), release to build. The ghost is a `TileSprite`, repeating the sprite per cell; placed farms render the same way.
- Left click builds; it leaves build mode unless `repeatPlacement` is set (all but the city). Right click or Esc cancels.
