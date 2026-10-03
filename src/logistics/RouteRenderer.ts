import Phaser from 'phaser';
import type { Building, BuildingSystem } from '../buildings/BuildingSystem';
import type { BuildingSelectedPayload } from '../buildings/BuildingSelection';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { MapData } from '../map/MapData';
import { TILE_SIZE } from '../map/MapRenderer';
import { ROUTE_TOGGLE_KEY } from './logistics';
import type { LogisticsSystem } from './LogisticsSystem';
import type { RouteNetwork } from './RouteNetwork';

const ROUTE_STYLE = {
  networkColor: 0xf4e3b5,
  networkAlpha: 0.45,
  networkScreenWidth: 2,
  fetchColor: 0x8ad0ff,
  fetchAlpha: 0.45,
  highlightColor: 0xffe08a,
  highlightFetchColor: 0x8ad0ff,
  highlightAlpha: 1,
  highlightScreenWidth: 3,
  // Above the ground overlays, below buildings.
  depth: 0.5,
};

const REDRAW_EVENTS = [GAME_EVENTS.ROUTES_CHANGED, GAME_EVENTS.BUILDING_COMPLETED, GAME_EVENTS.TICK];

// Draws every producer's route to its city as one network (toggled with ROUTE_TOGGLE_KEY) plus active
// city-to-city fetches. The selected building's routes are highlighted even when the network is hidden.
export class RouteRenderer {
  private graphics: Phaser.GameObjects.Graphics;
  private map?: MapData;
  private selected: Building | null = null;
  private showNetwork = true;
  private dirty = true;
  private drawnZoom = 0;

  constructor(
    private scene: Phaser.Scene,
    private buildings: BuildingSystem,
    private routes: RouteNetwork,
    private logistics: LogisticsSystem,
  ) {
    this.graphics = scene.add.graphics().setDepth(ROUTE_STYLE.depth);
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
    EventBus.on(GAME_EVENTS.BUILDING_SELECTED, this.onSelected, this);
    for (const event of REDRAW_EVENTS) EventBus.on(event, this.markDirty, this);
    scene.input.keyboard!.on(`keydown-${ROUTE_TOGGLE_KEY}`, this.toggleNetwork, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  // Redraws on zoom change so lines keep a constant on-screen width.
  update() {
    if (this.dirty || this.scene.cameras.main.zoom !== this.drawnZoom) this.draw();
  }

  private draw() {
    const zoom = this.scene.cameras.main.zoom;
    this.dirty = false;
    this.drawnZoom = zoom;
    this.graphics.clear();
    if (!this.map) return;

    const style = ROUTE_STYLE;
    if (this.showNetwork) {
      this.graphics.lineStyle(style.networkScreenWidth / zoom, style.networkColor, style.networkAlpha);
      this.strokeNetwork(this.producerPaths());
      this.graphics.lineStyle(style.networkScreenWidth / zoom, style.fetchColor, style.fetchAlpha);
      this.strokeNetwork(this.fetchPaths());
    }

    const selected = this.selected;
    if (!selected) return;
    const width = style.highlightScreenWidth / zoom;
    if (selected.def.storesGoods) {
      this.graphics.lineStyle(width, style.highlightColor, style.highlightAlpha);
      this.strokeNetwork(this.producerPaths(selected));
      this.graphics.lineStyle(width, style.highlightFetchColor, style.highlightAlpha);
      this.strokeNetwork(this.fetchPaths(selected));
    } else {
      const route = this.routes.routeToStore(selected);
      this.graphics.lineStyle(width, style.highlightColor, style.highlightAlpha);
      if (route) this.strokeNetwork([route.path]);
    }
  }

  // Routes of producers delivering to store, or of every producer.
  private producerPaths(store?: Building): (readonly number[])[] {
    const paths: (readonly number[])[] = [];
    for (const building of this.buildings.getBuildings()) {
      if (building.status !== 'complete' || building.def.storesGoods || building.jobs === 0) continue;
      const route = this.routes.routeToStore(building);
      if (route && (!store || route.to === store)) paths.push(route.path);
    }
    return paths;
  }

  // Routes of city haulers out on a fetch, optionally only those of home.
  private fetchPaths(home?: Building): (readonly number[])[] {
    const paths: (readonly number[])[] = [];
    for (const [owner, haulers] of this.logistics.entries()) {
      if (!owner.def.storesGoods || (home && owner !== home)) continue;
      for (const hauler of haulers) if (hauler.route && hauler.phase !== 'idle') paths.push(hauler.route.path);
    }
    return paths;
  }

  // Routes share segments near their city, so each cell-to-cell segment is stroked once.
  private strokeNetwork(paths: (readonly number[])[]) {
    const width = this.map!.width;
    const drawn = new Set<number>();
    const centre = (axis: number) => (axis + 0.5) * TILE_SIZE;
    this.graphics.beginPath();
    for (const path of paths) {
      for (let i = 1; i < path.length; i++) {
        const a = Math.min(path[i - 1], path[i]);
        const b = Math.max(path[i - 1], path[i]);
        const key = a * 8 + edgeDirection(a, b, width);
        if (drawn.has(key)) continue;
        drawn.add(key);
        this.graphics
          .moveTo(centre(a % width), centre(Math.floor(a / width)))
          .lineTo(centre(b % width), centre(Math.floor(b / width)));
      }
    }
    this.graphics.strokePath();
  }

  private toggleNetwork() {
    this.showNetwork = !this.showNetwork;
    this.dirty = true;
  }

  private onSelected({ building }: BuildingSelectedPayload) {
    this.selected = building;
    this.dirty = true;
  }

  private onMapGenerated(map: MapData) {
    this.map = map;
    this.selected = null;
    this.dirty = true;
  }

  private markDirty() {
    this.dirty = true;
  }

  destroy() {
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
    EventBus.off(GAME_EVENTS.BUILDING_SELECTED, this.onSelected, this);
    for (const event of REDRAW_EVENTS) EventBus.off(event, this.markDirty, this);
    this.scene.input.keyboard?.off(`keydown-${ROUTE_TOGGLE_KEY}`, this.toggleNetwork, this);
    this.graphics.destroy();
  }
}

// Which of the 4 forward neighbours b is from a (b > a), so a segment gets a unique key.
function edgeDirection(a: number, b: number, width: number): number {
  const diff = b - a;
  if (diff === 1) return 0;
  if (diff === width) return 1;
  return diff === width + 1 ? 2 : 3;
}
