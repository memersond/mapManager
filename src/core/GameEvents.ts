export const GAME_EVENTS = {
  SCENE_READY: 'scene:ready',
  MAP_GENERATED: 'map:generated',
  TILE_HOVERED: 'tile:hovered',
  TILE_HOVER_ENDED: 'tile:hoverEnded',
  STORAGE_CHANGED: 'storage:changed',
  BUILD_MODE_CHANGED: 'build:modeChanged',
  BUILDING_PLACED: 'building:placed',
  TERRITORY_CHANGED: 'territory:changed',
  CLOCK_STATE_CHANGED: 'clock:stateChanged',
  TICK: 'clock:tick',
  FLOWS_CHANGED: 'economy:flowsChanged',
} as const;
