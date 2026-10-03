import Phaser from 'phaser';
import { BuildingRenderer } from '../buildings/BuildingRenderer';
import { BuildingSystem } from '../buildings/BuildingSystem';
import { BuildPlacement } from '../buildings/BuildPlacement';
import { TerritoryRenderer } from '../buildings/TerritoryRenderer';
import { CameraController } from '../camera/CameraController';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { randomSeed } from '../core/random';
import { EconomySystem } from '../economy/EconomySystem';
import { generateMap } from '../map/MapGenerator';
import { MapRenderer } from '../map/MapRenderer';
import { TileHighlight } from '../map/TileHighlight';
import { TileHover } from '../map/TileHover';
import { ResourceRenderer } from '../resources/ResourceRenderer';
import { STARTING_STORAGE } from '../storage/items';
import { Storage } from '../storage/Storage';
import { GameClock } from '../time/GameClock';
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
  storage!: Storage;
  buildings!: BuildingSystem;
  economy!: EconomySystem;
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

    this.storage = new Storage(STARTING_STORAGE);
    this.buildings = new BuildingSystem(this.storage);
    this.economy = new EconomySystem(this.storage, this.buildings);
    this.clock = new GameClock(this);
    new BuildingRenderer(this);
    this.territoryRenderer = new TerritoryRenderer(this);
    this.buildPlacement = new BuildPlacement(this, this.buildings);

    const topBar = new TopBar();
    const tileTooltip = new TileTooltip();
    const storagePanel = new StoragePanel(this, this.storage);
    const buildMenu = new BuildMenu(this, this.buildings);
    const clockPanel = new ClockPanel(this.clock);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.buildings.destroy();
      this.economy.destroy();
      this.clock.destroy();
      clockPanel.destroy();
      topBar.destroy();
      tileTooltip.destroy();
      storagePanel.destroy();
      buildMenu.destroy();
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
    this.buildPlacement.update();
  }

  private generate(seed = randomSeed()) {
    const map = generateMap({ width: MAP_WIDTH, height: MAP_HEIGHT, seed });
    EventBus.emit(GAME_EVENTS.MAP_GENERATED, map);
  }
}
