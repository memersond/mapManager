# Time

## Clock (`src/time/GameClock.ts`)
- Time is measured in ticks. Nothing ticks until the first city completes (`BUILDING_COMPLETED`) — placing it is the start of the game. Reset on `MAP_GENERATED`.
- `update(delta)` (called from `MainScene`) accumulates real time and emits `TICK` `{ tick }` per elapsed interval.
- `togglePause()` / Space pauses and resumes. Only works once started.
- Emits `CLOCK_STATE_CHANGED` `{ started, paused, tick }` on start, pause/resume and reset.
- `tickProgress` — 0–1 fraction of real time into the next tick, for animating between ticks.
- `setTickInterval(ms)` changes speed at runtime (hook for future speed controls).

## Levers (`src/time/time.ts`)
- `TICK_INTERVAL_MS` — real ms per tick (default 1000).
- `MAX_TICKS_PER_FRAME` — caps catch-up after a long frame so time doesn't jump ahead after the window was hidden.
- `PAUSE_KEY`.

## UI (`src/ui/ClockPanel.ts`)
- Top-right: pause/play button and tick counter, or a "Place a city to begin" prompt before the start.
- Decision: buttons `preventDefault` on mousedown so they never take focus; otherwise Space would both pause and re-click the last clicked button.
