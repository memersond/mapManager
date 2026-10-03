import Phaser from 'phaser';
import './ui/ui.css';
import { BootScene } from './scenes/BootScene';
import { MainScene } from './scenes/MainScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1d1d1d',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [BootScene, MainScene],
});
