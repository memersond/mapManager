# Logistics

Goods don't teleport into a global stockpile. Producers pile output at their site, haulers carry it to the nearest city, and cities haul between each other to cover construction and base stock.

## Storage per building
- Every `Building` has its own `Storage` ([[Storage]]). For a city it is the city's stockpile; for a producer it is output awaiting pickup, capped at `SITE_STOCK_CAPACITY` (production stops while full).
- The left panel totals all city storages. Goods at sites and on haulers are listed in its tooltip but don't count as stored.

## Routes (`src/logistics/RouteNetwork.ts`)
- Buildings with `storesGoods` (cities) are stores. When one completes, a single multi-source Dijkstra (`shortestPathTree` in `src/map/movement.ts`) runs from every store cell, giving each map cell its cost, next step and nearest store.
- `nearestStore(rect)` / `routeToStore(building)` read that tree; nothing else is searched per building.
- City-to-city routes (`routeBetween`) use `findPath` and are cached per pair. Buildings never block movement, so they never go stale.
- Route `ticks` = `ceil(cost / HAULER_CELLS_PER_TICK)`, minimum 1. At the default of 1 every tile takes at least a tick (a grass tile exactly one). Cost is the same terrain-weighted cost as territory ([[Map]]), so grass is faster than sand or stone.

## Haulers (`src/logistics/LogisticsSystem.ts`)
- Haulers are citizens assigned per building (`Building.haulers`), like workers ([[Economy]]). Lowering the count retires haulers once they are idle; cargo is never dropped.
- **Producer haulers**: wait until `HAULER_CAPACITY * MIN_LOAD_FRACTION` is at the site, load up to `HAULER_CAPACITY`, travel to the nearest city, unload, walk back.
- **City haulers pull**: an idle hauler looks for the city's own shortfall and fetches it from the closest city that can spare it, then brings it home.
  - Tier 1 — construction: queued sites the city pays for. Donors keep only their own construction needs.
  - Tier 2 — base stock: `CITY_BASE_STOCK` + `CITY_BASE_STOCK_PER_CITIZEN × population`. Donors keep their construction needs and base stock.
  - Shortfall = wanted − stock − incoming (fetches and deliveries already on the way). Donor spare = stock − keep − already reserved by other fetches. Trips under `MIN_FETCH_AMOUNT` are skipped.
- Decision: pull rather than push, so the city that needs goods is where the player adds haulers.
- Decision: each hauler is simulated per tick (phase + ticks left) rather than as an abstract flow rate, so delays and capacity limits emerge naturally.

## Construction (`src/buildings/ConstructionSystem.ts`)
- Placing a building queues it (`status: 'queued'`, drawn faded). Its cost is locked at placement.
- The payer is the nearest city by travel cost. Each tick, any site whose payer holds the full cost pays and completes (`BUILDING_COMPLETED`). Sites don't block each other.
- The first city is the exception: it is paid from the starting supplies and completes immediately, taking the remaining supplies as its stock.
- Placement fails with `UNREACHABLE` if no city can reach the site.
- Queued sites can be cancelled from the building panel; nothing has been paid so nothing is refunded.

## Overlay (`src/logistics/RouteRenderer.ts`)
- Draws every producer's route to its city (shared segments stroked once) plus active city fetches in blue. `L` (`ROUTE_TOGGLE_KEY`) toggles it.
- The selected building's routes are always highlighted: a producer's route, or for a city every route delivering to it plus its haulers' fetch trips.

## Haulers on the map (`src/logistics/HaulerRenderer.ts`)
- Every hauler on the road is drawn each frame as a dot, gold when loaded (with its main cargo's item icon above) and grey when empty.
- Position = trip progress `(ticks − ticksLeft + GameClock.tickProgress) / ticks`, mapped along the path by cumulative step cost (`stepCost`), so haulers slow down on sand and stone and move smoothly between ticks. They freeze while paused.
- Style levers (`HAULER_STYLE`) at the top of the file.

## Levers (`src/logistics/logistics.ts`)
- `HAULER_CAPACITY`, `HAULER_CELLS_PER_TICK`, `MIN_LOAD_FRACTION`, `SITE_STOCK_CAPACITY`, `CITY_BASE_STOCK`, `CITY_BASE_STOCK_PER_CITIZEN`, `MIN_FETCH_AMOUNT`, `ROUTE_TOGGLE_KEY`.
- Per building: `maxHaulers`, `defaultHaulers` on the `BuildingDef` ([[Buildings]]).

## Not modelled yet
- Roads, carrying capacity by item, and shortages/starvation.
