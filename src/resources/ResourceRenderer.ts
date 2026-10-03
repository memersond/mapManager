import Phaser from 'phaser';
import { animationKey, ATLAS_KEY, getSpriteFrameCounts, spriteFrame } from '../assets/SpriteAtlas';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { MapData } from '../map/MapData';
import { TILE_SIZE } from '../map/MapRenderer';
import { getResourceDef } from './resources';

export class ResourceRenderer {
  private sprites: Phaser.GameObjects.Sprite[] = [];
  private frameCounts: Map<string, number>;

  constructor(private scene: Phaser.Scene) {
    this.frameCounts = getSpriteFrameCounts(scene);
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.render, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private render(map: MapData) {
    this.clear();

    for (const [index, node] of map.resources) {
      const def = getResourceDef(node.id);
      const frameCount = this.frameCounts.get(def.sprite) ?? 1;
      const x = (index % map.width) * TILE_SIZE;
      const y = Math.floor(index / map.width) * TILE_SIZE;

      const frame = def.spriteMode === 'variant' ? variantFor(index, frameCount) : 0;
      const sprite = this.scene.add.sprite(x, y, ATLAS_KEY, spriteFrame(def.sprite, frame)).setOrigin(0);

      // Random start frame so neighbouring nodes don't animate in lockstep.
      if (def.spriteMode === 'animate' && frameCount > 1) {
        sprite.play({ key: animationKey(def.sprite), startFrame: Math.floor(Math.random() * frameCount) });
      }
      this.sprites.push(sprite);
    }
  }

  private clear() {
    for (const sprite of this.sprites) sprite.destroy();
    this.sprites = [];
  }

  destroy() {
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.render, this);
    this.clear();
  }
}

// Hashes the cell index so a node keeps the same variant for a given map.
function variantFor(index: number, frameCount: number): number {
  return (Math.imul(index, 0x9e3779b1) >>> 16) % frameCount;
}
