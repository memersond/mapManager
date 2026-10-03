import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { TILE_SIZE } from '../map/MapRenderer';
import type { BuildingDef } from './buildings';
import { BUILDING_DEPTH, createBuildingSprite, type BuildingSprite } from './BuildingRenderer';
import { defaultRect, type BuildingSystem, type Rect } from './BuildingSystem';
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
// Left click builds; area buildings are sized by dragging and built on release. Right click or Esc cancels.
export class BuildPlacement {
  private def: BuildingDef | null = null;
  private ghost?: BuildingSprite;
  private preview: TerritoryOverlay;
  private rect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private dragStart: { x: number; y: number } | null = null;
  private previewX = NaN;
  private previewY = NaN;

  constructor(private scene: Phaser.Scene, private buildings: BuildingSystem) {
    this.preview = new TerritoryOverlay(scene, PREVIEW_STYLE);
    EventBus.on(GAME_EVENTS.BUILD_MODE_CHANGED, this.onModeChanged, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    scene.input.keyboard!.on('keydown-ESC', this.cancel, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update() {
    const def = this.def;
    if (!def || !this.ghost) return;

    const visible = this.scene.input.isOver || this.dragStart !== null;
    this.ghost.setVisible(visible);
    const pointer = this.scene.input.activePointer;
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    // Same rounding as TileHover so the footprint's top-left is the highlighted tile.
    const tileX = Math.floor(world.x / TILE_SIZE);
    const tileY = Math.floor(world.y / TILE_SIZE);
    this.rect = this.dragStart && def.area ? dragRect(def, this.dragStart, tileX, tileY) : defaultRect(def, tileX, tileY);

    this.ghost.setPosition(this.rect.x * TILE_SIZE, this.rect.y * TILE_SIZE);
    if (def.area) this.ghost.setSize(this.rect.width * TILE_SIZE, this.rect.height * TILE_SIZE);
    this.updatePreview(visible);

    const valid = !this.buildings.checkPlacement(def, this.rect);
    if (valid) this.ghost.clearTint();
    else this.ghost.setTint(GHOST_INVALID_TINT);
  }

  // Territory is only recomputed when the origin moves; the outline still restrokes on zoom.
  private updatePreview(visible: boolean) {
    if (!visible) {
      this.clearPreview();
      return;
    }
    if (this.rect.x !== this.previewX || this.rect.y !== this.previewY) {
      this.previewX = this.rect.x;
      this.previewY = this.rect.y;
      const territory = this.buildings.previewTerritory(this.def!, this.rect);
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
    this.dragStart = null;
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
    if (this.def.area) this.dragStart = { x: this.rect.x, y: this.rect.y };
    else this.tryPlace();
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    if (!this.def || !this.dragStart || pointer.button !== 0) return;
    this.update();
    this.dragStart = null;
    this.tryPlace();
  }

  private tryPlace() {
    if (this.buildings.place(this.def!, this.rect) && !this.def!.repeatPlacement) this.cancel();
  }

  private cancel() {
    if (!this.def) return;
    const payload: BuildModeChangedPayload = { def: null };
    EventBus.emit(GAME_EVENTS.BUILD_MODE_CHANGED, payload);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.BUILD_MODE_CHANGED, this.onModeChanged, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.scene.input.keyboard?.off('keydown-ESC', this.cancel, this);
    this.ghost?.destroy();
    this.preview.destroy();
  }
}

// Spans from the drag start towards the pointer, at least the def's minimum size and at most its area limits.
function dragRect(def: BuildingDef, start: { x: number; y: number }, tileX: number, tileY: number): Rect {
  const [x, width] = dragSpan(start.x, tileX, def.width, def.area!.maxWidth);
  const [y, height] = dragSpan(start.y, tileY, def.height, def.area!.maxHeight);
  return { x, y, width, height };
}

function dragSpan(start: number, current: number, min: number, max: number): [number, number] {
  const size = Phaser.Math.Clamp(Math.abs(current - start) + 1, min, max);
  return [current >= start ? start : start - size + 1, size];
}
