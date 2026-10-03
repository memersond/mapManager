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
