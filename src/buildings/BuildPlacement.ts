import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { TILE_SIZE } from '../map/MapRenderer';
import type { BuildingDef } from './buildings';
import { BUILDING_DEPTH, createBuildingSprite } from './BuildingRenderer';
import type { BuildingSystem } from './BuildingSystem';

const GHOST_ALPHA = 0.55;
const GHOST_INVALID_TINT = 0xff4040;
const GHOST_DEPTH = BUILDING_DEPTH + 5;

export interface BuildModeChangedPayload {
  def: BuildingDef | null;
}

// Shows a ghost of the selected building under the cursor; left click builds, right click or Esc cancels.
export class BuildPlacement {
  private def: BuildingDef | null = null;
  private ghost?: Phaser.GameObjects.Sprite;
  private originX = 0;
  private originY = 0;

  constructor(private scene: Phaser.Scene, private buildings: BuildingSystem) {
    EventBus.on(GAME_EVENTS.BUILD_MODE_CHANGED, this.onModeChanged, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.keyboard!.on('keydown-ESC', this.cancel, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update() {
    if (!this.def || !this.ghost) return;

    this.ghost.setVisible(this.scene.input.isOver);
    const pointer = this.scene.input.activePointer;
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    // Centre the footprint on the cursor rather than anchoring its corner.
    this.originX = Math.round(world.x / TILE_SIZE - this.def.width / 2);
    this.originY = Math.round(world.y / TILE_SIZE - this.def.height / 2);
    this.ghost.setPosition(this.originX * TILE_SIZE, this.originY * TILE_SIZE);

    const valid = !this.buildings.checkPlacement(this.def, this.originX, this.originY);
    if (valid) this.ghost.clearTint();
    else this.ghost.setTint(GHOST_INVALID_TINT);
  }

  private onModeChanged({ def }: BuildModeChangedPayload) {
    this.def = def;
    this.ghost?.destroy();
    this.ghost = def ? createBuildingSprite(this.scene, def).setAlpha(GHOST_ALPHA).setDepth(GHOST_DEPTH) : undefined;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.def) return;
    if (pointer.rightButtonDown()) {
      this.cancel();
      return;
    }
    if (!pointer.leftButtonDown()) return;

    this.update();
    if (this.buildings.place(this.def, this.originX, this.originY)) this.cancel();
  }

  private cancel() {
    if (!this.def) return;
    const payload: BuildModeChangedPayload = { def: null };
    EventBus.emit(GAME_EVENTS.BUILD_MODE_CHANGED, payload);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.BUILD_MODE_CHANGED, this.onModeChanged, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.keyboard?.off('keydown-ESC', this.cancel, this);
    this.ghost?.destroy();
  }
}
