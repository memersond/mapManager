import { cellIndex, type MapData } from './MapData';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function* rectCells({ x, y, width, height }: Rect) {
  for (let cy = y; cy < y + height; cy++) {
    for (let cx = x; cx < x + width; cx++) yield { cx, cy };
  }
}

export function footprint(map: MapData, rect: Rect): number[] {
  return Array.from(rectCells(rect), ({ cx, cy }) => cellIndex(map, cx, cy));
}
