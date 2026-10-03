import Phaser from 'phaser';
import { ATLAS_KEY, spriteFrame } from '../assets/SpriteAtlas';
import type { Building } from '../buildings/BuildingSystem';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { MapData } from '../map/MapData';
import { TILE_SIZE } from '../map/MapRenderer';
import { stepCost } from '../map/movement';
import { getItemDef, itemEntries } from '../storage/items';
import type { GameClock } from '../time/GameClock';
import type { Hauler, LogisticsSystem } from './LogisticsSystem';

const HAULER_STYLE = {
  // Radius in tiles, but never smaller than minScreenRadius pixels on screen.
  radius: 0.25,
  minScreenRadius: 3,
  loadedColor: 0xffe08a,
  emptyColor: 0xbbbbbb,
  outlineColor: 0x202020,
  outlineScreenWidth: 1,
  // Cargo icon size in tiles, drawn just above the hauler.
  iconSize: 0.7,
  depth: 2,
};

// Draws every hauler on the road, moving smoothly between ticks using the clock's tick progress.
// Loaded haulers carry an icon of their main cargo.
export class HaulerRenderer {
  private graphics: Phaser.GameObjects.Graphics;
  private icons: Phaser.GameObjects.Image[] = [];
  private map?: MapData;
  // Cumulative travel cost at each cell of a route path, so movement speed follows the terrain.
  private pathCosts = new WeakMap<readonly number[], Float64Array>();

  constructor(private scene: Phaser.Scene, private logistics: LogisticsSystem, private clock: GameClock) {
    this.graphics = scene.add.graphics().setDepth(HAULER_STYLE.depth);
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update() {
    this.graphics.clear();
    if (!this.map) return;

    const style = HAULER_STYLE;
    const zoom = this.scene.cameras.main.zoom;
    const radius = Math.max(style.radius * TILE_SIZE, style.minScreenRadius / zoom);
    const progress = this.clock.tickProgress;
    let iconCount = 0;

    this.graphics.lineStyle(style.outlineScreenWidth / zoom, style.outlineColor, 1);
    for (const [home, haulers] of this.logistics.entries()) {
      for (const hauler of haulers) {
        if (hauler.phase === 'idle' || !hauler.route) continue;
        const { x, y } = this.position(home, hauler, progress);
        const cargo = itemEntries(hauler.cargo).find(([, amount]) => amount > 0);

        this.graphics
          .fillStyle(cargo ? style.loadedColor : style.emptyColor, 1)
          .fillCircle(x, y, radius)
          .strokeCircle(x, y, radius);
        if (cargo) this.placeIcon(iconCount++, getItemDef(cargo[0]).sprite, x, y - radius);
      }
    }
    for (let i = iconCount; i < this.icons.length; i++) this.icons[i].setVisible(false);
  }

  private position(home: Building, hauler: Hauler, progress: number): { x: number; y: number } {
    const route = hauler.route!;
    const path = route.path;
    if (path.length === 1) return cellCentre(this.map!, path[0], path[0], 0);
    const costs = this.costsFor(path);
    const total = costs[costs.length - 1];

    // Paths run from home towards the other end, except producer routes, which always run producer → city.
    const forward = hauler.phase === 'fetching' || (hauler.phase === 'delivering' && !home.def.storesGoods);
    const fraction = Math.min(1, (route.ticks - hauler.ticksLeft + progress) / route.ticks);
    const distance = (forward ? fraction : 1 - fraction) * total;

    let i = 1;
    while (i < path.length - 1 && costs[i] < distance) i++;
    const span = costs[i] - costs[i - 1];
    return cellCentre(this.map!, path[i - 1], path[i], span > 0 ? (distance - costs[i - 1]) / span : 0);
  }

  private costsFor(path: readonly number[]): Float64Array {
    let costs = this.pathCosts.get(path);
    if (!costs) {
      costs = new Float64Array(path.length);
      for (let i = 1; i < path.length; i++) costs[i] = costs[i - 1] + stepCost(this.map!, path[i - 1], path[i]);
      this.pathCosts.set(path, costs);
    }
    return costs;
  }

  private placeIcon(index: number, sprite: string, x: number, y: number) {
    const size = HAULER_STYLE.iconSize * TILE_SIZE;
    this.icons[index] ??= this.scene.add.image(0, 0, ATLAS_KEY).setDepth(HAULER_STYLE.depth + 0.1).setOrigin(0.5, 1);
    this.icons[index].setFrame(spriteFrame(sprite)).setDisplaySize(size, size).setPosition(x, y).setVisible(true);
  }

  private onMapGenerated(map: MapData) {
    this.map = map;
  }

  destroy() {
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
    this.graphics.destroy();
    for (const icon of this.icons) icon.destroy();
  }
}

// Point a fraction t of the way from the centre of cell a to the centre of cell b.
function cellCentre(map: MapData, a: number, b: number, t: number): { x: number; y: number } {
  const ax = a % map.width;
  const ay = Math.floor(a / map.width);
  const bx = b % map.width;
  const by = Math.floor(b / map.width);
  return { x: (ax + (bx - ax) * t + 0.5) * TILE_SIZE, y: (ay + (by - ay) * t + 0.5) * TILE_SIZE };
}
