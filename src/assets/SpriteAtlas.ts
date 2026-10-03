import Phaser from 'phaser';

export const ATLAS_KEY = 'atlas';
const ATLAS_PATH = 'generated/atlas';

interface AtlasFrameData {
  duration?: number;
}

export function loadSpriteAtlas(scene: Phaser.Scene) {
  scene.load.atlas(ATLAS_KEY, `${ATLAS_PATH}.png`, `${ATLAS_PATH}.json`);
}

export function spriteFrame(sprite: string, frame = 0): string {
  return `${sprite}/${frame}`;
}

export function animationKey(sprite: string): string {
  return `${ATLAS_KEY}:${sprite}`;
}

// Atlas frames are named "<sprite>/<frame index>" by tools/asepritePlugin.ts.
export function getSpriteFrameCounts(scene: Phaser.Scene): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of scene.textures.get(ATLAS_KEY).getFrameNames()) {
    const sprite = name.slice(0, name.lastIndexOf('/'));
    counts.set(sprite, (counts.get(sprite) ?? 0) + 1);
  }
  return counts;
}

// Every multi-frame sprite gets a looping animation using the frame durations set in Aseprite.
export function createSpriteAnimations(scene: Phaser.Scene) {
  const texture = scene.textures.get(ATLAS_KEY);

  for (const [sprite, frameCount] of getSpriteFrameCounts(scene)) {
    if (frameCount < 2 || scene.anims.exists(animationKey(sprite))) continue;

    const frames = Array.from({ length: frameCount }, (_, i) => {
      const frame = spriteFrame(sprite, i);
      const { duration = 100 } = texture.get(frame).customData as AtlasFrameData;
      return { key: ATLAS_KEY, frame, duration };
    });

    scene.anims.create({
      key: animationKey(sprite),
      frames,
      duration: frames.reduce((total, frame) => total + frame.duration, 0),
      repeat: -1,
    });
  }
}
