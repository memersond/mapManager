import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { TILE_SIZE } from './MapRenderer';
import type { TileHoveredPayload } from './TileHover';

const OUTLINE_COLOR = 0xffffff;
const OUTLINE_SCREEN_WIDTH = 2;

export class TileHighlight {
  private graphics: Phaser.GameObjects.Graphics;
  private tileX = -1;
  private tileY = -1;
  private drawnZoom = 0;

  constructor(private scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(10);
    EventBus.on(GAME_EVENTS.TILE_HOVERED, this.onHovered, this);
    EventBus.on(GAME_EVENTS.TILE_HOVER_ENDED, this.onHoverEnded, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  // Redraws on zoom change so the outline keeps a constant on-screen width.
  update() {
    if (this.tileX !== -1 && this.scene.cameras.main.zoom !== this.drawnZoom) this.draw();
  }

  private onHovered({ cell }: TileHoveredPayload) {
    this.tileX = cell.x;
    this.tileY = cell.y;
    this.draw();
  }

  private onHoverEnded() {
    this.tileX = -1;
    this.graphics.clear();
  }

  private draw() {
    const zoom = this.scene.cameras.main.zoom;
    const lineWidth = OUTLINE_SCREEN_WIDTH / zoom;
    this.drawnZoom = zoom;
    this.graphics
      .clear()
      .lineStyle(lineWidth, OUTLINE_COLOR, 1)
      .strokeRect(
        this.tileX * TILE_SIZE + lineWidth / 2,
        this.tileY * TILE_SIZE + lineWidth / 2,
        TILE_SIZE - lineWidth,
        TILE_SIZE - lineWidth,
      );
  }

  destroy() {
    EventBus.off(GAME_EVENTS.TILE_HOVERED, this.onHovered, this);
    EventBus.off(GAME_EVENTS.TILE_HOVER_ENDED, this.onHoverEnded, this);
    this.graphics.destroy();
  }
}
