import Phaser from 'phaser';
import { CameraController } from '../camera/CameraController';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { randomSeed } from '../core/random';
import { generateMap } from '../map/MapGenerator';
import { MapRenderer } from '../map/MapRenderer';

const MAP_WIDTH = 256;
const MAP_HEIGHT = 256;

export class MainScene extends Phaser.Scene {
  private cameraController!: CameraController;

  constructor() {
    super('MainScene');
  }

  create() {
    new MapRenderer(this);
    this.cameraController = new CameraController(this);

    this.input.keyboard!.on('keydown-R', () => this.generate());
    this.generate();

    EventBus.emit(GAME_EVENTS.SCENE_READY, this);
  }

  update(_time: number, delta: number) {
    this.cameraController.update(delta);
  }

  private generate(seed = randomSeed()) {
    const map = generateMap({ width: MAP_WIDTH, height: MAP_HEIGHT, seed });
    EventBus.emit(GAME_EVENTS.MAP_GENERATED, map);
  }
}
