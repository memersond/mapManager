# Economy

## Flows (`src/economy/EconomySystem.ts`)
- A flow is a labelled per-tick amount on an item: positive for producers, negative for consumers. Recomputed on `MAP_GENERATED`, `BUILDING_COMPLETED` and `STAFFING_CHANGED`, then emitted as `FLOWS_CHANGED` `{ flows }`. Only complete buildings count.
- Flows are the theoretical rates shown in the storage tooltip. They are not applied to a global stock any more:
  - Production — `production` per worker × workers, added each tick to the building's own site storage. See [[Logistics]].
  - Maintenance and citizen upkeep (`CITIZEN_UPKEEP` × population) are taken each tick from the paying city: the building itself for cities, otherwise its nearest city. `Storage.take` clamps at 0; shortage effects are not modelled yet.

## Staffing
- One global labour pool: population is the sum over complete buildings; employed is every building's `workers + haulers`.
- Decision: staffing is manual. `EconomySystem.setStaff(building, role, count)` clamps to `jobs` (workers) or `def.maxHaulers` (haulers) and to free citizens, then emits `STAFFING_CHANGED` `{ building }`.
- `AUTO_STAFF_NEW_BUILDINGS` (`src/population/population.ts`) fills a building's jobs and `defaultHaulers` from free citizens when it completes.
- Emits `WORKFORCE_CHANGED` `{ population, employed }` after each recompute.

## Population (`src/population/population.ts`)
- Population lives on each complete `Building` (`population`), set from `BuildingDef.startingPopulation` on completion. City starts with 20.
- `CITIZEN_UPKEEP` — items each citizen consumes per tick from their city (lever; 0.1 food).

## UI
- `StoragePanel` shows the stock across all cities and its measured average change over `RATE_WINDOW_TICKS`. Measured rather than summed from flows because hauling delays and construction spending make the flow sum misleading.
- The row tooltip lists stock in cities, at work sites and being hauled, then producer and consumer flows.
- `BuildingPanel` (right side, opened by clicking a building — `BuildingSelection`) has +/- for workers and haulers (shift for ±5), site stock, route and haul capacity for producers, and have/want inventory and active trips for cities. Haul capacity turns red when below production.
- Hovering a building shows a summary in the tile tooltip; for a city, its inventory.

## Top bar (`src/ui/TopBar.ts`)
- Full-width bar across the top showing total citizens and available (unemployed) workers. Height is the `--top-bar-height` CSS variable; the storage and clock panels sit below it.
