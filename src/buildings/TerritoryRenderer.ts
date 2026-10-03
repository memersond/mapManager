import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { TILE_SIZE } from '../map/MapRenderer';
import type { TerritoryChangedPayload } from './BuildingSystem';

const TEXTURE_KEY = 'territory-fill';
const FILL_COLOR = 0xfff2c0;
const FILL_ALPHA = 0.18;
const OUTLINE_COLOR = 0xffe08a;
const OUTLINE_ALPHA = 0.9;
const OUTLINE_SCREEN_WIDTH = 2;
const FILL_DEPTH = -0.5;
const OUTLINE_DEPTH = 5;

// Fill is one pixel per cell scaled up, like MapRenderer. Outline is the edges between claimed and unclaimed cells.
export class TerritoryRenderer {
  private fill?: Phaser.GameObjects.Image;
  private outline: Phaser.GameObjects.Graphics;
  // Flat x1, y1, x2, y2 in world units, cached so zoom changes only restroke.
  private edges: number[] = [];
  private drawnZoom = 0;

  constructor(private scene: Phaser.Scene) {
    this.outline = scene.add.graphics().setDepth(OUTLINE_DEPTH);
    EventBus.on(GAME_EVENTS.TERRITORY_CHANGED, this.onTerritoryChanged, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  // Redraws on zoom change so the outline keeps a constant on-screen width.
  update() {
    if (this.scene.cameras.main.zoom !== this.drawnZoom) this.drawOutline();
  }

  private onTerritoryChanged({ map, territory }: TerritoryChangedPayload) {
    this.drawFill(map.width, map.height, territory);
    this.edges = findEdges(map.width, map.height, territory);
    this.drawOutline();
  }

  private drawFill(width: number, height: number, territory: Uint8Array) {
    this.fill?.destroy();
    if (this.scene.textures.exists(TEXTURE_KEY)) this.scene.textures.remove(TEXTURE_KEY);

    const texture = this.scene.textures.createCanvas(TEXTURE_KEY, width, height)!;
    const imageData = texture.context.createImageData(width, height);
    const pixels = imageData.data;
    for (let i = 0; i < territory.length; i++) {
      if (!territory[i]) continue;
      const p = i * 4;
      pixels[p] = (FILL_COLOR >> 16) & 0xff;
      pixels[p + 1] = (FILL_COLOR >> 8) & 0xff;
      pixels[p + 2] = FILL_COLOR & 0xff;
      pixels[p + 3] = 255;
    }
    texture.context.putImageData(imageData, 0, 0);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.fill = this.scene.add
      .image(0, 0, TEXTURE_KEY)
      .setOrigin(0)
      .setScale(TILE_SIZE)
      .setAlpha(FILL_ALPHA)
      .setDepth(FILL_DEPTH);
  }

  private drawOutline() {
    const zoom = this.scene.cameras.main.zoom;
    this.drawnZoom = zoom;
    this.outline.clear();
    if (!this.edges.length) return;

    this.outline.lineStyle(OUTLINE_SCREEN_WIDTH / zoom, OUTLINE_COLOR, OUTLINE_ALPHA).beginPath();
    for (let i = 0; i < this.edges.length; i += 4) {
      this.outline.moveTo(this.edges[i], this.edges[i + 1]).lineTo(this.edges[i + 2], this.edges[i + 3]);
    }
    this.outline.strokePath();
  }

  destroy() {
    EventBus.off(GAME_EVENTS.TERRITORY_CHANGED, this.onTerritoryChanged, this);
    this.fill?.destroy();
    this.outline.destroy();
  }
}

function findEdges(width: number, height: number, territory: Uint8Array): number[] {
  const edges: number[] = [];
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && territory[y * width + x] === 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      const left = x * TILE_SIZE;
      const top = y * TILE_SIZE;
      const right = left + TILE_SIZE;
      const bottom = top + TILE_SIZE;
      if (!inside(x, y - 1)) edges.push(left, top, right, top);
      if (!inside(x, y + 1)) edges.push(left, bottom, right, bottom);
      if (!inside(x - 1, y)) edges.push(left, top, left, bottom);
      if (!inside(x + 1, y)) edges.push(right, top, right, bottom);
    }
  }
  return edges;
}
