import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { getCellInfo, isInBounds, type CellInfo, type MapData } from './MapData';
import { TILE_SIZE } from './MapRenderer';

export interface TileHoveredPayload {
  cell: CellInfo;
}

// Checked every frame rather than on pointer move, so the hovered tile also updates while the camera pans.
export class TileHover {
  private map?: MapData;
  private pointerInGame = false;
  private hoveredX = -1;
  private hoveredY = -1;

  constructor(private scene: Phaser.Scene) {
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
    scene.input.on(Phaser.Input.Events.GAME_OVER, this.onPointerEnter, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerEnter, this);
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.onGameOut, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update() {
    if (!this.map || !this.pointerInGame) return;

    const pointer = this.scene.input.activePointer;
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = Math.floor(world.x / TILE_SIZE);
    const y = Math.floor(world.y / TILE_SIZE);
    if (x === this.hoveredX && y === this.hoveredY) return;

    if (!isInBounds(this.map, x, y)) {
      this.clear();
      return;
    }

    this.hoveredX = x;
    this.hoveredY = y;
    const payload: TileHoveredPayload = { cell: getCellInfo(this.map, x, y) };
    EventBus.emit(GAME_EVENTS.TILE_HOVERED, payload);
  }

  private onMapGenerated(map: MapData) {
    this.map = map;
    this.clear();
  }

  private onPointerEnter() {
    this.pointerInGame = true;
  }

  private onGameOut() {
    this.pointerInGame = false;
    this.clear();
  }

  private clear() {
    if (this.hoveredX === -1) return;
    this.hoveredX = -1;
    this.hoveredY = -1;
    EventBus.emit(GAME_EVENTS.TILE_HOVER_ENDED);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
    this.scene.input.off(Phaser.Input.Events.GAME_OVER, this.onPointerEnter, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerEnter, this);
    this.scene.input.off(Phaser.Input.Events.GAME_OUT, this.onGameOut, this);
  }
}
