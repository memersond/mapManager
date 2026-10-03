import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { TILE_SIZE } from '../map/MapRenderer';
import type { BuildingDef } from './buildings';
import { BUILDING_DEPTH, createBuildingSprite } from './BuildingRenderer';
import type { BuildingSystem } from './BuildingSystem';
import { TerritoryOverlay } from './TerritoryOverlay';

const GHOST_ALPHA = 0.55;
const GHOST_INVALID_TINT = 0xff4040;
const GHOST_DEPTH = BUILDING_DEPTH + 5;

const PREVIEW_STYLE = {
  textureKey: 'territory-preview-fill',
  fillColor: 0xffffff,
  fillAlpha: 0.12,
  outlineColor: 0xffffff,
  outlineAlpha: 0.8,
  outlineScreenWidth: 2,
  fillDepth: -0.4,
  outlineDepth: 6,
};

export interface BuildModeChangedPayload {
  def: BuildingDef | null;
}

// Shows a ghost of the selected building with its top-left on the hovered tile, plus the territory it would claim.
// Left click builds, right click or Esc cancels.
export class BuildPlacement {
  private def: BuildingDef | null = null;
  private ghost?: Phaser.GameObjects.Sprite;
  private preview: TerritoryOverlay;
  private originX = 0;
  private originY = 0;
  private previewX = NaN;
  private previewY = NaN;

  constructor(private scene: Phaser.Scene, private buildings: BuildingSystem) {
    this.preview = new TerritoryOverlay(scene, PREVIEW_STYLE);
    EventBus.on(GAME_EVENTS.BUILD_MODE_CHANGED, this.onModeChanged, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.keyboard!.on('keydown-ESC', this.cancel, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update() {
    if (!this.def || !this.ghost) return;

    const visible = this.scene.input.isOver;
    this.ghost.setVisible(visible);
    const pointer = this.scene.input.activePointer;
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    // Same rounding as TileHover so the footprint's top-left is the highlighted tile.
    this.originX = Math.floor(world.x / TILE_SIZE);
    this.originY = Math.floor(world.y / TILE_SIZE);
    this.ghost.setPosition(this.originX * TILE_SIZE, this.originY * TILE_SIZE);
    this.updatePreview(visible);

    const valid = !this.buildings.checkPlacement(this.def, this.originX, this.originY);
    if (valid) this.ghost.clearTint();
    else this.ghost.setTint(GHOST_INVALID_TINT);
  }

  // Territory is only recomputed when the origin moves; the outline still restrokes on zoom.
  private updatePreview(visible: boolean) {
    if (!visible) {
      this.clearPreview();
      return;
    }
    if (this.originX !== this.previewX || this.originY !== this.previewY) {
      this.previewX = this.originX;
      this.previewY = this.originY;
      const territory = this.buildings.previewTerritory(this.def!, this.originX, this.originY);
      if (territory) this.preview.setMask(territory.map.width, territory.map.height, territory.territory);
      else this.preview.clear();
    }
    this.preview.update();
  }

  private clearPreview() {
    this.previewX = NaN;
    this.previewY = NaN;
    this.preview.clear();
  }

  private onModeChanged({ def }: BuildModeChangedPayload) {
    this.def = def;
    this.clearPreview();
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
    this.preview.destroy();
  }
}
