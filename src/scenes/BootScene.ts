import Phaser from 'phaser';
import { createSpriteAnimations, loadSpriteAtlas } from '../assets/SpriteAtlas';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    loadSpriteAtlas(this);
  }

  create() {
    createSpriteAnimations(this);
    this.scene.start('MainScene');
  }
}
