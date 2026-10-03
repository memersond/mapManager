import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { MapData } from '../map/MapData';
import { TILE_SIZE } from '../map/MapRenderer';

const PAN_SPEED = 800;
const WHEEL_ZOOM_STEP = 1.15;
const KEY_ZOOM_SPEED = 1.5;
const MAX_ZOOM = 4;

export class CameraController {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private keys: Record<'W' | 'A' | 'S' | 'D' | 'Q' | 'E', Phaser.Input.Keyboard.Key>;
  private worldWidth = 0;
  private worldHeight = 0;

  constructor(private scene: Phaser.Scene) {
    this.camera = scene.cameras.main;
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D,Q,E') as CameraController['keys'];

    scene.input.mouse?.disableContextMenu();
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(delta: number) {
    const seconds = delta / 1000;
    const panDistance = (PAN_SPEED * seconds) / this.camera.zoom;

    if (this.keys.A.isDown) this.camera.scrollX -= panDistance;
    if (this.keys.D.isDown) this.camera.scrollX += panDistance;
    if (this.keys.W.isDown) this.camera.scrollY -= panDistance;
    if (this.keys.S.isDown) this.camera.scrollY += panDistance;

    const zoomFactor = Math.pow(KEY_ZOOM_SPEED, seconds * 2);
    const { width, height } = this.camera;
    if (this.keys.E.isDown) this.zoomAt(this.camera.zoom * zoomFactor, width / 2, height / 2);
    if (this.keys.Q.isDown) this.zoomAt(this.camera.zoom / zoomFactor, width / 2, height / 2);
  }

  private onMapGenerated(map: MapData) {
    this.worldWidth = map.width * TILE_SIZE;
    this.worldHeight = map.height * TILE_SIZE;
    this.camera.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.camera.setZoom(Math.max(this.minZoom(), 1));
    this.camera.centerOn(this.worldWidth / 2, this.worldHeight / 2);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!pointer.middleButtonDown()) return;
    this.camera.scrollX -= (pointer.x - pointer.prevPosition.x) / this.camera.zoom;
    this.camera.scrollY -= (pointer.y - pointer.prevPosition.y) / this.camera.zoom;
  }

  private onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) {
    const factor = dy > 0 ? 1 / WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP;
    this.zoomAt(this.camera.zoom * factor, pointer.x, pointer.y);
  }

  private onResize() {
    this.camera.setZoom(Phaser.Math.Clamp(this.camera.zoom, this.minZoom(), MAX_ZOOM));
  }

  // Keeps the world point under (screenX, screenY) fixed while zooming.
  private zoomAt(targetZoom: number, screenX: number, screenY: number) {
    const cam = this.camera;
    const newZoom = Phaser.Math.Clamp(targetZoom, this.minZoom(), MAX_ZOOM);
    const halfW = cam.width * 0.5;
    const halfH = cam.height * 0.5;

    const worldX = cam.scrollX + halfW + (screenX - halfW) / cam.zoom;
    const worldY = cam.scrollY + halfH + (screenY - halfH) / cam.zoom;

    cam.setZoom(newZoom);
    cam.scrollX = worldX - halfW - (screenX - halfW) / newZoom;
    cam.scrollY = worldY - halfH - (screenY - halfH) / newZoom;
  }

  private minZoom(): number {
    if (!this.worldWidth) return 0.1;
    return Math.max(this.camera.width / this.worldWidth, this.camera.height / this.worldHeight);
  }

  destroy() {
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
  }
}
