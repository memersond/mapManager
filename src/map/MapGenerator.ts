import { createNoise2D } from 'simplex-noise';
import { createRandom } from '../core/random';
import type { MapData } from './MapData';
import { terrainForElevation } from './terrain';

export interface MapGeneratorOptions {
  width: number;
  height: number;
  seed: number;
}

const NOISE_SCALE = 3.5;
const OCTAVES = 5;
const PERSISTENCE = 0.5;
const LACUNARITY = 2;
const EDGE_FALLOFF_EXPONENT = 2.5;

export function generateMap({ width, height, seed }: MapGeneratorOptions): MapData {
  const noise2D = createNoise2D(createRandom(seed));
  const elevation = new Float32Array(width * height);
  const terrain = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = x / width;
      const ny = y / height;

      let sum = 0;
      let amplitude = 1;
      let frequency = NOISE_SCALE;
      let norm = 0;
      for (let o = 0; o < OCTAVES; o++) {
        sum += amplitude * noise2D(nx * frequency, ny * frequency);
        norm += amplitude;
        amplitude *= PERSISTENCE;
        frequency *= LACUNARITY;
      }
      const noiseValue = (sum / norm + 1) / 2;

      // Square-bump distance: 0 at center, 1 on every edge, so edges are always water.
      const dx = nx * 2 - 1;
      const dy = ny * 2 - 1;
      const edgeDistance = 1 - (1 - dx * dx) * (1 - dy * dy);
      const value = noiseValue * (1 - Math.pow(edgeDistance, EDGE_FALLOFF_EXPONENT));

      elevation[i] = value;
      terrain[i] = terrainForElevation(value).id;
    }
  }

  return { seed, width, height, elevation, terrain };
}
