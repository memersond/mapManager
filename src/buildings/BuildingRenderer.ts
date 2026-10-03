import Phaser from 'phaser';
import { animationKey, ATLAS_KEY, spriteFrame } from '../assets/SpriteAtlas';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { TILE_SIZE } from '../map/MapRenderer';
import type { BuildingDef } from './buildings';
import type { BuildingPlacedPayload } from './BuildingSystem';

export const BUILDING_DEPTH = 1;

export class BuildingRenderer {
  private sprites: Phaser.GameObjects.Sprite[] = [];

  constructor(private scene: Phaser.Scene) {
    EventBus.on(GAME_EVENTS.BUILDING_PLACED, this.onPlaced, this);
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.clear, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private onPlaced({ building }: BuildingPlacedPayload) {
    const sprite = createBuildingSprite(this.scene, building.def)
      .setPosition(building.x * TILE_SIZE, building.y * TILE_SIZE)
      .setDepth(BUILDING_DEPTH);
    this.sprites.push(sprite);
  }

  private clear() {
    for (const sprite of this.sprites) sprite.destroy();
    this.sprites = [];
  }

  destroy() {
    EventBus.off(GAME_EVENTS.BUILDING_PLACED, this.onPlaced, this);
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.clear, this);
    this.clear();
  }
}

// Sized to the footprint so the sprite always covers exactly the cells it occupies.
export function createBuildingSprite(scene: Phaser.Scene, def: BuildingDef): Phaser.GameObjects.Sprite {
  const sprite = scene.add
    .sprite(0, 0, ATLAS_KEY, spriteFrame(def.sprite))
    .setOrigin(0)
    .setDisplaySize(def.width * TILE_SIZE, def.height * TILE_SIZE);
  if (scene.anims.exists(animationKey(def.sprite))) sprite.play(animationKey(def.sprite));
  return sprite;
}
