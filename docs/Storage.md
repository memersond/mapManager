# Storage

## Items (`src/storage/items.ts`)
- Items are what the player stockpiles (wood, ore, food). They are separate from map resources ([[Resources]]): a tree node yields wood.
- `ITEM_DEFS` holds name, hover description and atlas sprite. Order is the panel display order.
- `STARTING_STORAGE` — starting amounts (lever).

## Storage (`src/storage/Storage.ts`)
- Owned by `MainScene`. `add` / `remove` / `has` / `get`; `remove` fails without changing anything if there is not enough.
- Every change emits `STORAGE_CHANGED` `{ itemId, amount }` on the `EventBus`.

## UI (`src/ui/StoragePanel.ts`)
- DOM panel on the left edge, one row per item with icon and amount; hovering a row shows name and description.
- Icons are frame 0 of the item's atlas sprite, converted to a data URL with `textures.getBase64`, so DOM UI reuses the same Aseprite art as the map. See [[Assets]].
