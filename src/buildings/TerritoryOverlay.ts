import Phaser from 'phaser';
import { TILE_SIZE } from '../map/MapRenderer';

export interface TerritoryOverlayStyle {
  textureKey: string;
  fillColor: number;
  fillAlpha: number;
  outlineColor: number;
  outlineAlpha: number;
  outlineScreenWidth: number;
  fillDepth: number;
  outlineDepth: number;
}

// Draws a cell mask as a fill (one pixel per cell scaled up, like MapRenderer) plus an outline along its edges.
export class TerritoryOverlay {
  private fill?: Phaser.GameObjects.Image;
  private outline: Phaser.GameObjects.Graphics;
  // Flat x1, y1, x2, y2 in world units, cached so zoom changes only restroke.
  private edges: number[] = [];
  private drawnZoom = 0;

  constructor(private scene: Phaser.Scene, private style: TerritoryOverlayStyle) {
    this.outline = scene.add.graphics().setDepth(style.outlineDepth);
  }

  // Redraws on zoom change so the outline keeps a constant on-screen width.
  update() {
    if (this.scene.cameras.main.zoom !== this.drawnZoom) this.drawOutline();
  }

  // mask holds 1 for cells inside, indexed like MapData.terrain.
  setMask(width: number, height: number, mask: Uint8Array) {
    this.drawFill(width, height, mask);
    this.edges = findEdges(width, height, mask);
    this.drawOutline();
  }

  clear() {
    this.fill?.setVisible(false);
    this.edges = [];
    this.outline.clear();
  }

  private drawFill(width: number, height: number, mask: Uint8Array) {
    const { textures } = this.scene;
    const { textureKey } = this.style;
    let texture = textures.exists(textureKey) ? (textures.get(textureKey) as Phaser.Textures.CanvasTexture) : null;
    if (texture && (texture.width !== width || texture.height !== height)) {
      this.fill?.destroy();
      this.fill = undefined;
      textures.remove(textureKey);
      texture = null;
    }
    if (!texture) {
      texture = textures.createCanvas(textureKey, width, height)!;
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    const imageData = texture.context.createImageData(width, height);
    const pixels = imageData.data;
    const { fillColor } = this.style;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const p = i * 4;
      pixels[p] = (fillColor >> 16) & 0xff;
      pixels[p + 1] = (fillColor >> 8) & 0xff;
      pixels[p + 2] = fillColor & 0xff;
      pixels[p + 3] = 255;
    }
    texture.context.putImageData(imageData, 0, 0);
    texture.refresh();

    this.fill ??= this.scene.add
      .image(0, 0, textureKey)
      .setOrigin(0)
      .setScale(TILE_SIZE)
      .setAlpha(this.style.fillAlpha)
      .setDepth(this.style.fillDepth);
    this.fill.setVisible(true);
  }

  private drawOutline() {
    const zoom = this.scene.cameras.main.zoom;
    this.drawnZoom = zoom;
    this.outline.clear();
    if (!this.edges.length) return;

    const { outlineScreenWidth, outlineColor, outlineAlpha } = this.style;
    this.outline.lineStyle(outlineScreenWidth / zoom, outlineColor, outlineAlpha).beginPath();
    for (let i = 0; i < this.edges.length; i += 4) {
      this.outline.moveTo(this.edges[i], this.edges[i + 1]).lineTo(this.edges[i + 2], this.edges[i + 3]);
    }
    this.outline.strokePath();
  }

  destroy() {
    this.fill?.destroy();
    this.outline.destroy();
    if (this.scene.textures.exists(this.style.textureKey)) this.scene.textures.remove(this.style.textureKey);
  }
}

function findEdges(width: number, height: number, mask: Uint8Array): number[] {
  const edges: number[] = [];
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;

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
