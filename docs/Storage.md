# Storage

## Items (`src/storage/items.ts`)
- Items are what the player stockpiles (wood, ore, food). They are separate from map resources ([[Resources]]): a tree node yields wood.
- `ItemAmounts` — shared `item → amount` map type.
- `ITEM_DEFS` holds name, hover description and atlas sprite. Order is the panel display order.
- `STARTING_STORAGE` — starting supplies (lever). They pay for the first city and become its stock.
- `itemEntries` / `addAmounts` — typed helpers for `ItemAmounts`.

## Storage (`src/storage/Storage.ts`)
- One per building (`Building.storage`): a city's stockpile or a producer's output awaiting pickup. See [[Logistics]].
- `add` / `remove` / `take` / `has` / `hasAll` / `get` / `total`; `remove` fails without changing anything if there is not enough, `take` removes what it can and returns the amount taken.
- Every change emits `STORAGE_CHANGED` `{ storage, itemId, amount }` on the `EventBus`.

## UI (`src/ui/StoragePanel.ts`)
- DOM panel on the left edge, one row per item with icon and the total held across all cities (`BuildingSystem.getStored`); hovering a row shows name and description via the shared `HoverTooltip` (`src/ui/HoverTooltip.ts`).
- The rate is the measured change in that total; the tooltip breaks stock down by cities, sites and haulers and lists flows. See [[Economy]].
- Icons are frame 0 of the item's atlas sprite, converted to a data URL with `textures.getBase64`, so DOM UI reuses the same Aseprite art as the map. See [[Assets]].
