import Phaser from 'phaser';
import { BuildingRenderer } from '../buildings/BuildingRenderer';
import { BuildingSelection } from '../buildings/BuildingSelection';
import { BuildingSystem } from '../buildings/BuildingSystem';
import { ConstructionSystem } from '../buildings/ConstructionSystem';
import { BuildPlacement } from '../buildings/BuildPlacement';
import { TerritoryRenderer } from '../buildings/TerritoryRenderer';
import { CameraController } from '../camera/CameraController';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { randomSeed } from '../core/random';
import { EconomySystem } from '../economy/EconomySystem';
import { HaulerRenderer } from '../logistics/HaulerRenderer';
import { LogisticsSystem } from '../logistics/LogisticsSystem';
import { RouteNetwork } from '../logistics/RouteNetwork';
import { RouteRenderer } from '../logistics/RouteRenderer';
import { generateMap } from '../map/MapGenerator';
import { MapRenderer } from '../map/MapRenderer';
import { TileHighlight } from '../map/TileHighlight';
import { TileHover } from '../map/TileHover';
import { ResourceRenderer } from '../resources/ResourceRenderer';
import { GameClock } from '../time/GameClock';
import { BuildingPanel } from '../ui/BuildingPanel';
import { BuildMenu } from '../ui/BuildMenu';
import { ClockPanel } from '../ui/ClockPanel';
import { StoragePanel } from '../ui/StoragePanel';
import { TileTooltip } from '../ui/TileTooltip';
import { TopBar } from '../ui/TopBar';

const MAP_WIDTH = 256;
const MAP_HEIGHT = 256;

export class MainScene extends Phaser.Scene {
  private cameraController!: CameraController;
  private tileHover!: TileHover;
  private tileHighlight!: TileHighlight;
  private territoryRenderer!: TerritoryRenderer;
  private buildPlacement!: BuildPlacement;
  private buildingSelection!: BuildingSelection;
  private routeRenderer!: RouteRenderer;
  private haulerRenderer!: HaulerRenderer;
  routes!: RouteNetwork;
  buildings!: BuildingSystem;
  construction!: ConstructionSystem;
  economy!: EconomySystem;
  logistics!: LogisticsSystem;
  clock!: GameClock;

  constructor() {
    super('MainScene');
  }

  create() {
    new MapRenderer(this);
    new ResourceRenderer(this);
    this.cameraController = new CameraController(this);
    this.tileHover = new TileHover(this);
    this.tileHighlight = new TileHighlight(this);

    // Created first so routes are rebuilt before anything else reacts to a completed city.
    this.routes = new RouteNetwork();
    this.buildings = new BuildingSystem(this.routes);
    this.economy = new EconomySystem(this.buildings, this.routes);
    this.construction = new ConstructionSystem(this.buildings, this.routes);
    this.logistics = new LogisticsSystem(this.buildings, this.routes, this.construction);
    this.clock = new GameClock(this);
    new BuildingRenderer(this);
    this.territoryRenderer = new TerritoryRenderer(this);
    this.routeRenderer = new RouteRenderer(this, this.buildings, this.routes, this.logistics);
    this.haulerRenderer = new HaulerRenderer(this, this.logistics, this.clock);
    this.buildPlacement = new BuildPlacement(this, this.buildings);
    this.buildingSelection = new BuildingSelection(this, this.buildings);

    const topBar = new TopBar();
    const tileTooltip = new TileTooltip(this.buildings);
    const storagePanel = new StoragePanel(this, this.buildings, this.logistics);
    const buildMenu = new BuildMenu(this, this.buildings);
    const clockPanel = new ClockPanel(this.clock);
    const buildingPanel = new BuildingPanel(this.buildings, this.economy, this.construction, this.logistics, this.routes);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.routes.destroy();
      this.buildings.destroy();
      this.economy.destroy();
      this.construction.destroy();
      this.logistics.destroy();
      this.clock.destroy();
      clockPanel.destroy();
      topBar.destroy();
      tileTooltip.destroy();
      storagePanel.destroy();
      buildMenu.destroy();
      buildingPanel.destroy();
    });

    this.input.keyboard!.on('keydown-R', () => this.generate());
    this.generate();

    EventBus.emit(GAME_EVENTS.SCENE_READY, this);
  }

  update(_time: number, delta: number) {
    this.cameraController.update(delta);
    this.clock.update(delta);
    this.tileHover.update();
    this.tileHighlight.update();
    this.territoryRenderer.update();
    this.routeRenderer.update();
    this.haulerRenderer.update();
    this.buildPlacement.update();
    this.buildingSelection.update();
  }

  private generate(seed = randomSeed()) {
    const map = generateMap({ width: MAP_WIDTH, height: MAP_HEIGHT, seed });
    EventBus.emit(GAME_EVENTS.MAP_GENERATED, map);
  }
}
