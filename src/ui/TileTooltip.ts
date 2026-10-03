import type { Building, BuildingSystem } from '../buildings/BuildingSystem';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { SITE_STOCK_CAPACITY } from '../logistics/logistics';
import type { CellInfo } from '../map/MapData';
import type { TileHoveredPayload } from '../map/TileHover';
import { ITEM_DEFS } from '../storage/items';
import { formatAmount, formatLine } from './format';

const CURSOR_OFFSET = 16;

export class TileTooltip {
  private element: HTMLDivElement;
  private cell: CellInfo | null = null;

  constructor(private buildings: BuildingSystem) {
    this.element = document.createElement('div');
    this.element.className = 'tile-tooltip';
    this.element.hidden = true;
    document.body.appendChild(this.element);

    window.addEventListener('mousemove', this.onMouseMove);
    EventBus.on(GAME_EVENTS.TILE_HOVERED, this.onHovered, this);
    EventBus.on(GAME_EVENTS.TILE_HOVER_ENDED, this.onHoverEnded, this);
    EventBus.on(GAME_EVENTS.TICK, this.render, this);
  }

  private onHovered({ cell }: TileHoveredPayload) {
    this.cell = cell;
    this.render();
    this.element.hidden = false;
  }

  // Re-rendered every tick so a hovered city's inventory stays current.
  private render() {
    const cell = this.cell;
    if (!cell) return;
    const resources = cell.resources.length
      ? cell.resources.map(({ def, amount }) => `<li>${def.name} (${amount})</li>`).join('')
      : '<li class="tile-tooltip__empty">None</li>';
    const building = this.buildings.getBuildingAt(cell.x, cell.y);

    this.element.innerHTML = `
      ${building ? formatBuilding(building) : ''}
      <div class="tile-tooltip__title">${cell.terrain.name}</div>
      <div class="tile-tooltip__coords">${cell.x}, ${cell.y}</div>
      <div class="tile-tooltip__label">Movement</div>
      <div class="tile-tooltip__value">${formatMovement(cell.terrain.movementSpeed)}</div>
      <div class="tile-tooltip__label">Resources</div>
      <ul class="tile-tooltip__list">${resources}</ul>
    `;
  }

  private onHoverEnded() {
    this.cell = null;
    this.element.hidden = true;
  }

  // Flips to the other side of the cursor near the window edges.
  private onMouseMove = (event: MouseEvent) => {
    const { offsetWidth, offsetHeight } = this.element;
    let left = event.clientX + CURSOR_OFFSET;
    let top = event.clientY + CURSOR_OFFSET;
    if (left + offsetWidth > window.innerWidth) left = event.clientX - CURSOR_OFFSET - offsetWidth;
    if (top + offsetHeight > window.innerHeight) top = event.clientY - CURSOR_OFFSET - offsetHeight;
    this.element.style.transform = `translate(${left}px, ${top}px)`;
  };

  destroy() {
    window.removeEventListener('mousemove', this.onMouseMove);
    EventBus.off(GAME_EVENTS.TILE_HOVERED, this.onHovered, this);
    EventBus.off(GAME_EVENTS.TILE_HOVER_ENDED, this.onHoverEnded, this);
    EventBus.off(GAME_EVENTS.TICK, this.render, this);
    this.element.remove();
  }
}

function formatBuilding(building: Building): string {
  const title = `<div class="tile-tooltip__title">${building.name}</div>`;
  if (building.status === 'queued') return `${title}<div class="tile-tooltip__value">Under construction</div>`;

  if (building.def.storesGoods) {
    const inventory = ITEM_DEFS.map((def) => formatLine(def.name, formatAmount(building.storage.get(def.id)))).join('');
    return `
      ${title}
      <div class="tile-tooltip__coords">Population ${building.population} · ${building.haulers} haulers</div>
      <div class="tile-tooltip__label">Inventory</div>
      <div class="tile-tooltip__value">${inventory}</div>
    `;
  }

  return `
    ${title}
    <div class="tile-tooltip__coords">${building.workers}/${building.jobs} workers · ${building.haulers} haulers</div>
    <div class="tile-tooltip__label">Awaiting pickup</div>
    <div class="tile-tooltip__value">${formatAmount(building.storage.total())} / ${SITE_STOCK_CAPACITY}</div>
  `;
}

function formatMovement(speed: number): string {
  return speed > 0 ? `${Math.round(speed * 100)}%` : 'Impassable';
}
