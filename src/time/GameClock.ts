import Phaser from 'phaser';
import { BUILDING } from '../buildings/buildings';
import type { BuildingPlacedPayload } from '../buildings/BuildingSystem';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { MAX_TICKS_PER_FRAME, PAUSE_KEY, TICK_INTERVAL_MS } from './time';

export interface TickPayload {
  tick: number;
}

export interface ClockStateChangedPayload {
  started: boolean;
  paused: boolean;
  tick: number;
}

// Time starts when the first city is placed and resets with each new map.
export class GameClock {
  private started = false;
  private paused = false;
  private tick = 0;
  private elapsed = 0;
  private tickIntervalMs = TICK_INTERVAL_MS;

  constructor(private scene: Phaser.Scene) {
    EventBus.on(GAME_EVENTS.BUILDING_PLACED, this.onBuildingPlaced, this);
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.reset, this);
    scene.input.keyboard!.on(`keydown-${PAUSE_KEY}`, this.togglePause, this);
  }

  get isStarted(): boolean {
    return this.started;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setTickInterval(ms: number) {
    this.tickIntervalMs = ms;
  }

  update(delta: number) {
    if (!this.started || this.paused) return;

    this.elapsed = Math.min(this.elapsed + delta, this.tickIntervalMs * MAX_TICKS_PER_FRAME);
    while (this.elapsed >= this.tickIntervalMs) {
      this.elapsed -= this.tickIntervalMs;
      this.tick++;
      const payload: TickPayload = { tick: this.tick };
      EventBus.emit(GAME_EVENTS.TICK, payload);
    }
  }

  togglePause() {
    if (!this.started) return;
    this.paused = !this.paused;
    this.emitState();
  }

  private onBuildingPlaced({ building }: BuildingPlacedPayload) {
    if (this.started || building.def.id !== BUILDING.CITY) return;
    this.started = true;
    this.emitState();
  }

  private reset() {
    this.started = false;
    this.paused = false;
    this.tick = 0;
    this.elapsed = 0;
    this.emitState();
  }

  private emitState() {
    const payload: ClockStateChangedPayload = { started: this.started, paused: this.paused, tick: this.tick };
    EventBus.emit(GAME_EVENTS.CLOCK_STATE_CHANGED, payload);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.BUILDING_PLACED, this.onBuildingPlaced, this);
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.reset, this);
    this.scene.input.keyboard?.off(`keydown-${PAUSE_KEY}`, this.togglePause, this);
  }
}
