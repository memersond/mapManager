import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { TerritoryChangedPayload } from './BuildingSystem';
import { TerritoryOverlay } from './TerritoryOverlay';

const TERRITORY_STYLE = {
  textureKey: 'territory-fill',
  fillColor: 0xfff2c0,
  fillAlpha: 0.18,
  outlineColor: 0xffe08a,
  outlineAlpha: 0.9,
  outlineScreenWidth: 2,
  fillDepth: -0.5,
  outlineDepth: 5,
};

export class TerritoryRenderer {
  private overlay: TerritoryOverlay;

  constructor(scene: Phaser.Scene) {
    this.overlay = new TerritoryOverlay(scene, TERRITORY_STYLE);
    EventBus.on(GAME_EVENTS.TERRITORY_CHANGED, this.onTerritoryChanged, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update() {
    this.overlay.update();
  }

  private onTerritoryChanged({ map, territory }: TerritoryChangedPayload) {
    this.overlay.setMask(map.width, map.height, territory);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.TERRITORY_CHANGED, this.onTerritoryChanged, this);
    this.overlay.destroy();
  }
}
