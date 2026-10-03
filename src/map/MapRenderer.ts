import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { MapData } from './MapData';
import { TERRAIN_DEFS } from './terrain';

export const TILE_SIZE = 16;
const TEXTURE_KEY = 'map-terrain';

// Draws one pixel per cell into a canvas texture, then scales it up; far cheaper than a sprite per cell.
export class MapRenderer {
  private image?: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene) {
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.render, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private render(map: MapData) {
    this.image?.destroy();
    if (this.scene.textures.exists(TEXTURE_KEY)) this.scene.textures.remove(TEXTURE_KEY);

    const texture = this.scene.textures.createCanvas(TEXTURE_KEY, map.width, map.height)!;
    const imageData = texture.context.createImageData(map.width, map.height);
    const pixels = imageData.data;

    for (let i = 0; i < map.terrain.length; i++) {
      const color = cellColor(map.terrain[i], map.elevation[i]);
      const p = i * 4;
      pixels[p] = (color >> 16) & 0xff;
      pixels[p + 1] = (color >> 8) & 0xff;
      pixels[p + 2] = color & 0xff;
      pixels[p + 3] = 255;
    }

    texture.context.putImageData(imageData, 0, 0);
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.image = this.scene.add.image(0, 0, TEXTURE_KEY).setOrigin(0).setScale(TILE_SIZE).setDepth(-1);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.render, this);
    this.image?.destroy();
  }
}

function cellColor(terrainId: number, elevation: number): number {
  const index = TERRAIN_DEFS.findIndex((def) => def.id === terrainId);
  const def = TERRAIN_DEFS[index];
  const min = index > 0 ? TERRAIN_DEFS[index - 1].maxElevation : 0;
  const t = Phaser.Math.Clamp((elevation - min) / (def.maxElevation - min), 0, 1);
  return lerpColor(def.colorLow, def.colorHigh, t);
}

function lerpColor(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 0xff) + (((b >> 16) & 0xff) - ((a >> 16) & 0xff)) * t;
  const g = ((a >> 8) & 0xff) + (((b >> 8) & 0xff) - ((a >> 8) & 0xff)) * t;
  const bl = (a & 0xff) + ((b & 0xff) - (a & 0xff)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
