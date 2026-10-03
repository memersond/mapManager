
export interface MapData {
  seed: number;
  width: number;
  height: number;
  elevation: Float32Array;
  terrain: Uint8Array;
}

export function cellIndex(map: MapData, x: number, y: number): number {
  return y * map.width + x;
}
