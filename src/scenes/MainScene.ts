import Phaser from 'phaser';
import { CameraController } from '../camera/CameraController';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { randomSeed } from '../core/random';
import { generateMap } from '../map/MapGenerator';
import { MapRenderer } from '../map/MapRenderer';
import { TileHighlight } from '../map/TileHighlight';
import { TileHover } from '../map/TileHover';
import { ResourceRenderer } from '../resources/ResourceRenderer';
import { STARTING_STORAGE } from '../storage/items';
import { Storage } from '../storage/Storage';
import { StoragePanel } from '../ui/StoragePanel';
import { TileTooltip } from '../ui/TileTooltip';

const MAP_WIDTH = 256;
const MAP_HEIGHT = 256;

export class MainScene extends Phaser.Scene {
  private cameraController!: CameraController;
  private tileHover!: TileHover;
  private tileHighlight!: TileHighlight;
  storage!: Storage;

  constructor() {
    super('MainScene');
  }

  create() {
    new MapRenderer(this);
    new ResourceRenderer(this);
    this.cameraController = new CameraController(this);
    this.tileHover = new TileHover(this);
    this.tileHighlight = new TileHighlight(this);

    const tileTooltip = new TileTooltip();
    this.storage = new Storage(STARTING_STORAGE);
    const storagePanel = new StoragePanel(this, this.storage);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      tileTooltip.destroy();
      storagePanel.destroy();
    });

    this.input.keyboard!.on('keydown-R', () => this.generate());
    this.generate();

    EventBus.emit(GAME_EVENTS.SCENE_READY, this);
  }

  update(_time: number, delta: number) {
    this.cameraController.update(delta);
    this.tileHover.update();
    this.tileHighlight.update();
  }

  private generate(seed = randomSeed()) {
    const map = generateMap({ width: MAP_WIDTH, height: MAP_HEIGHT, seed });
    EventBus.emit(GAME_EVENTS.MAP_GENERATED, map);
  }
}
