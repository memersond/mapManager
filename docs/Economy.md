# Economy

## Flows (`src/economy/EconomySystem.ts`)
- A flow is a labelled per-tick amount on an item: positive for producers, negative for consumers.
- Recomputed from `BuildingSystem.getBuildings()` on `BUILDING_PLACED` and `MAP_GENERATED`, then emitted as `FLOWS_CHANGED` `{ flows }` (a map of item → entries).
- Each `TICK` applies the net flow per item to [[Storage]]. Consumption uses `Storage.take`, which clamps at 0. Shortage effects are not modelled yet.
- Current consumers:
  - Building maintenance — `maintenance` on each `BuildingDef` (see [[Buildings]]), grouped per building type.
  - Citizens — total population × `CITIZEN_UPKEEP`.
- Producers will add positive entries here.

## Population (`src/population/population.ts`)
- Population lives on each placed `Building` (`population`), seeded from `BuildingDef.startingPopulation`. City starts with 20.
- `CITIZEN_UPKEEP` — items each citizen consumes per tick (lever; 0.1 food).

## UI
- `StoragePanel` shows the net rate per tick beside each amount, green for gain, red for loss, hidden when 0.
- The row tooltip lists producers and consumers with their per-tick amounts.
