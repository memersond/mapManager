import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { TILE_SIZE } from '../map/MapRenderer';
import type { BuildModeChangedPayload } from './BuildPlacement';
import type { Building, BuildingCancelledPayload, BuildingSystem } from './BuildingSystem';

const OUTLINE_COLOR = 0xffe08a;
const OUTLINE_SCREEN_WIDTH = 2;
const OUTLINE_DEPTH = 9;

export interface BuildingSelectedPayload {
  building: Building | null;
}

// Left click on a building selects it (outside build mode); clicking empty ground or Esc deselects.
export class BuildingSelection {
  private graphics: Phaser.GameObjects.Graphics;
  private selected: Building | null = null;
  private buildMode = false;
  private drawnZoom = 0;

  constructor(private scene: Phaser.Scene, private buildings: BuildingSystem) {
    this.graphics = scene.add.graphics().setDepth(OUTLINE_DEPTH);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.keyboard!.on('keydown-ESC', this.deselect, this);
    EventBus.on(GAME_EVENTS.BUILD_MODE_CHANGED, this.onModeChanged, this);
    EventBus.on(GAME_EVENTS.BUILDING_SELECTED, this.onSelected, this);
    EventBus.on(GAME_EVENTS.BUILDING_CANCELLED, this.onCancelled, this);
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.deselect, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  // Redraws on zoom change so the outline keeps a constant on-screen width.
  update() {
    if (this.selected && this.scene.cameras.main.zoom !== this.drawnZoom) this.draw();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.buildMode || !pointer.leftButtonDown()) return;
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const building = this.buildings.getBuildingAt(Math.floor(world.x / TILE_SIZE), Math.floor(world.y / TILE_SIZE));
    this.select(building ?? null);
  }

  private select(building: Building | null) {
    const payload: BuildingSelectedPayload = { building };
    EventBus.emit(GAME_EVENTS.BUILDING_SELECTED, payload);
  }

  private deselect() {
    if (this.selected) this.select(null);
  }

  private onSelected({ building }: BuildingSelectedPayload) {
    this.selected = building;
    this.draw();
  }

  private onCancelled({ building }: BuildingCancelledPayload) {
    if (building === this.selected) this.select(null);
  }

  private onModeChanged({ def }: BuildModeChangedPayload) {
    this.buildMode = def !== null;
  }

  private draw() {
    const zoom = this.scene.cameras.main.zoom;
    const lineWidth = OUTLINE_SCREEN_WIDTH / zoom;
    this.drawnZoom = zoom;
    this.graphics.clear();
    if (!this.selected) return;
    const { x, y, width, height } = this.selected;
    this.graphics
      .lineStyle(lineWidth, OUTLINE_COLOR, 1)
      .strokeRect(
        x * TILE_SIZE + lineWidth / 2,
        y * TILE_SIZE + lineWidth / 2,
        width * TILE_SIZE - lineWidth,
        height * TILE_SIZE - lineWidth,
      );
  }

  destroy() {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.keyboard?.off('keydown-ESC', this.deselect, this);
    EventBus.off(GAME_EVENTS.BUILD_MODE_CHANGED, this.onModeChanged, this);
    EventBus.off(GAME_EVENTS.BUILDING_SELECTED, this.onSelected, this);
    EventBus.off(GAME_EVENTS.BUILDING_CANCELLED, this.onCancelled, this);
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.deselect, this);
    this.graphics.destroy();
  }
}
