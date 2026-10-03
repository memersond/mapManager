# Architecture

## Stack
- **Electron** — desktop shell (`electron/main.cjs`, `electron/preload.cjs`)
- **Phaser 4** — rendering / game loop (`src/`)
- **Vite** — dev server and bundler for the renderer
- **TypeScript**

## Structure
- `src/scenes/` — Phaser scenes. `BootScene` loads assets, then starts `MainScene`.
- `src/core/EventBus.ts` — global event emitter for decoupled communication between modules.
- `src/core/GameEvents.ts` — event name constants (`GAME_EVENTS`).
- `src/map/` — map data, generation and rendering. See [[Map]].
- `src/camera/` — camera input controls.

## Decisions
- Renderer runs with `contextIsolation: true` and no node integration; anything native goes through `preload.cjs`.
- Modules communicate through `EventBus` rather than direct references.

## Scripts
- `npm run dev` — Vite dev server + Electron with hot reload
- `npm run build` — type check and bundle to `dist/`
- `npm start` — run Electron against `dist/`
