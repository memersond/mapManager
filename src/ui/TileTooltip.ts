import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { TileHoveredPayload } from '../map/TileHover';

const CURSOR_OFFSET = 16;

export class TileTooltip {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tile-tooltip';
    this.element.hidden = true;
    document.body.appendChild(this.element);

    window.addEventListener('mousemove', this.onMouseMove);
    EventBus.on(GAME_EVENTS.TILE_HOVERED, this.onHovered, this);
    EventBus.on(GAME_EVENTS.TILE_HOVER_ENDED, this.onHoverEnded, this);
  }

  private onHovered({ cell }: TileHoveredPayload) {
    const resources = cell.resources.length
      ? cell.resources.map((resource) => `<li>${resource}</li>`).join('')
      : '<li class="tile-tooltip__empty">None</li>';

    this.element.innerHTML = `
      <div class="tile-tooltip__title">${cell.terrain.name}</div>
      <div class="tile-tooltip__coords">${cell.x}, ${cell.y}</div>
      <div class="tile-tooltip__label">Resources</div>
      <ul class="tile-tooltip__list">${resources}</ul>
    `;
    this.element.hidden = false;
  }

  private onHoverEnded() {
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
    this.element.remove();
  }
}
