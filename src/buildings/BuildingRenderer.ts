import Phaser from 'phaser';
import { animationKey, ATLAS_KEY, spriteFrame } from '../assets/SpriteAtlas';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { TILE_SIZE } from '../map/MapRenderer';
import type { BuildingDef } from './buildings';
import type { BuildingCancelledPayload, BuildingCompletedPayload, BuildingPlacedPayload } from './BuildingSystem';

export const BUILDING_DEPTH = 1;
const UNDER_CONSTRUCTION_ALPHA = 0.45;

// Queued buildings are drawn faded until construction completes.
export class BuildingRenderer {
  private sprites = new Map<number, BuildingSprite>();

  constructor(private scene: Phaser.Scene) {
    EventBus.on(GAME_EVENTS.BUILDING_PLACED, this.onPlaced, this);
    EventBus.on(GAME_EVENTS.BUILDING_COMPLETED, this.onCompleted, this);
    EventBus.on(GAME_EVENTS.BUILDING_CANCELLED, this.onCancelled, this);
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.clear, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private onPlaced({ building }: BuildingPlacedPayload) {
    const sprite = createBuildingSprite(this.scene, building.def, building.width, building.height)
      .setPosition(building.x * TILE_SIZE, building.y * TILE_SIZE)
      .setDepth(BUILDING_DEPTH)
      .setAlpha(UNDER_CONSTRUCTION_ALPHA);
    this.sprites.set(building.id, sprite);
  }

  private onCompleted({ building }: BuildingCompletedPayload) {
    this.sprites.get(building.id)?.setAlpha(1);
  }

  private onCancelled({ building }: BuildingCancelledPayload) {
    this.sprites.get(building.id)?.destroy();
    this.sprites.delete(building.id);
  }

  private clear() {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }

  destroy() {
    EventBus.off(GAME_EVENTS.BUILDING_PLACED, this.onPlaced, this);
    EventBus.off(GAME_EVENTS.BUILDING_COMPLETED, this.onCompleted, this);
    EventBus.off(GAME_EVENTS.BUILDING_CANCELLED, this.onCancelled, this);
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.clear, this);
    this.clear();
  }
}

export type BuildingSprite = Phaser.GameObjects.Sprite | Phaser.GameObjects.TileSprite;

// Sized to the footprint so the sprite always covers exactly the cells it occupies.
// Area buildings repeat their sprite once per cell instead of stretching it.
export function createBuildingSprite(
  scene: Phaser.Scene,
  def: BuildingDef,
  width = def.width,
  height = def.height,
): BuildingSprite {
  if (def.area) {
    return scene.add
      .tileSprite(0, 0, width * TILE_SIZE, height * TILE_SIZE, ATLAS_KEY, spriteFrame(def.sprite))
      .setOrigin(0);
  }
  const sprite = scene.add
    .sprite(0, 0, ATLAS_KEY, spriteFrame(def.sprite))
    .setOrigin(0)
    .setDisplaySize(width * TILE_SIZE, height * TILE_SIZE);
  if (scene.anims.exists(animationKey(def.sprite))) sprite.play(animationKey(def.sprite));
  return sprite;
}
