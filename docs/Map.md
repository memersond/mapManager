# Map

## Generation (`src/map/MapGenerator.ts`)
- Seeded (`createRandom` in `src/core/random.ts`) so a map can be reproduced from its seed.
- Elevation = fractal simplex noise (`simplex-noise`), several octaves.
- Multiplied by an edge falloff (square-bump distance, 0 at center, 1 at edges), so edges are always water.
- Terrain is picked from elevation via `TERRAIN_DEFS` in `src/map/terrain.ts` (deep water → water → sand → grass → stone).
- Output is `MapData`: flat `Float32Array` elevation + `Uint8Array` terrain ids, indexed `y * width + x`.

## Rendering (`src/map/MapRenderer.ts`)
- One pixel per cell in a canvas texture, scaled by `TILE_SIZE` with nearest filtering. Avoids a game object per cell.
- Color is lerped between each terrain's `colorLow`/`colorHigh` by elevation within its band.

## Camera (`src/camera/CameraController.ts`)
- WASD pan, Q/E zoom, middle mouse drag, mouse wheel zoom toward cursor.
- Min zoom keeps the map filling the screen.

## Events
- `MAP_GENERATED` — emitted with `MapData`; renderer and camera react to it independently.

## Debug
- `R` regenerates with a new seed.

## Hover (`src/map/TileHover.ts`, `TileHighlight.ts`, `src/ui/TileTooltip.ts`)
- `TileHover` converts the pointer to a cell every frame (so it stays correct while the camera pans) and emits `TILE_HOVERED` with `CellInfo` only when the cell changes, or `TILE_HOVER_ENDED`.
- `TileHighlight` draws the outline; its line width is scaled by zoom to stay the same on screen.
- `TileTooltip` is a DOM element, not Phaser. Decision: menus and panels are HTML/CSS overlays (`src/ui/`), since they're easier to lay out and style than in-canvas UI.
- `getCellInfo` in `MapData.ts` is the single place cell details are assembled. `resources` is empty until resources exist.
