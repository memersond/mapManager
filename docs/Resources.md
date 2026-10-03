# Resources

## Definitions (`src/resources/resources.ts`)
- `RESOURCE_DEFS` — one entry per resource: sprite, `spriteMode`, per-terrain `spawnChance`, `baseRichness`, `richnessVariance`.
- Global levers: `RICHNESS_MULTIPLIER`, `SPAWN_CHANCE_MULTIPLIER`.
- Order matters: earlier defs claim a cell first, so rarer resources go first.

## Generation (`src/resources/ResourceGenerator.ts`)
- Run from `generateMap`, seeded from the map seed so resources are reproducible.
- Each cell rolls each def's chance for its terrain; first hit wins. One node per cell.
- Richness = `baseRichness * (1 ± richnessVariance) * RICHNESS_MULTIPLIER`. Decision: variance is kept small so no single node trivialises the economy.
- Stored on `MapData.resources`, a `Map` keyed by cell index (sparse).

## Rendering (`src/resources/ResourceRenderer.ts`)
- One sprite per node from the shared atlas. `variant` mode picks a frame by hashing the cell; `animate` mode loops with a random start frame.
