import Phaser from 'phaser';
import { ATLAS_KEY, spriteFrame } from '../assets/SpriteAtlas';
import type { BuildModeChangedPayload } from '../buildings/BuildPlacement';
import { BUILDING_DEFS, type BuildingCost, type BuildingDef, type BuildingId } from '../buildings/buildings';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { getItemDef, type ItemId } from '../storage/items';
import { HoverTooltip } from './HoverTooltip';

const ACTIVE_CLASS = 'build-menu__button--active';
const DISABLED_CLASS = 'build-menu__button--disabled';

// Affordability is refreshed whenever storage or the building count changes.
const REFRESH_EVENTS = [GAME_EVENTS.STORAGE_CHANGED, GAME_EVENTS.BUILDING_PLACED, GAME_EVENTS.MAP_GENERATED];

export class BuildMenu {
  private element: HTMLDivElement;
  private tooltip = new HoverTooltip();
  private buttons = new Map<BuildingId, HTMLButtonElement>();
  private selected: BuildingDef | null = null;

  constructor(scene: Phaser.Scene, private buildings: BuildingSystem) {
    this.element = document.createElement('div');
    this.element.className = 'build-menu';
    for (const def of BUILDING_DEFS) this.element.appendChild(this.createButton(scene, def));
    document.body.appendChild(this.element);

    EventBus.on(GAME_EVENTS.BUILD_MODE_CHANGED, this.onModeChanged, this);
    for (const event of REFRESH_EVENTS) EventBus.on(event, this.refresh, this);
    this.refresh();
  }

  private createButton(scene: Phaser.Scene, def: BuildingDef): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'build-menu__button';

    const icon = document.createElement('img');
    icon.className = 'build-menu__icon';
    icon.src = scene.textures.getBase64(ATLAS_KEY, spriteFrame(def.sprite));
    icon.alt = def.name;

    const label = document.createElement('span');
    label.textContent = def.name;

    button.append(icon, label);
    button.addEventListener('click', () => {
      if (this.selected !== def && !this.buildings.canAfford(def)) return;
      const payload: BuildModeChangedPayload = { def: this.selected === def ? null : def };
      EventBus.emit(GAME_EVENTS.BUILD_MODE_CHANGED, payload);
    });
    this.tooltip.attach(button, 'top', () => {
      const costClass = this.buildings.canAfford(def) ? '' : ' hover-tooltip__cost--unaffordable';
      return `
        <div class="hover-tooltip__title">${def.name}</div>
        <div class="hover-tooltip__description">${def.description}</div>
        <div class="hover-tooltip__cost${costClass}">${formatCost(this.buildings.getCost(def))}</div>
      `;
    });
    this.buttons.set(def.id, button);
    return button;
  }

  // Not using the disabled attribute so the tooltip still shows the cost on hover.
  private refresh() {
    for (const def of BUILDING_DEFS) {
      const affordable = this.buildings.canAfford(def);
      const button = this.buttons.get(def.id)!;
      button.classList.toggle(DISABLED_CLASS, !affordable);
      button.setAttribute('aria-disabled', String(!affordable));
      if (!affordable && this.selected === def) {
        const payload: BuildModeChangedPayload = { def: null };
        EventBus.emit(GAME_EVENTS.BUILD_MODE_CHANGED, payload);
      }
    }
  }

  private onModeChanged({ def }: BuildModeChangedPayload) {
    this.selected = def;
    for (const [id, button] of this.buttons) button.classList.toggle(ACTIVE_CLASS, id === def?.id);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.BUILD_MODE_CHANGED, this.onModeChanged, this);
    for (const event of REFRESH_EVENTS) EventBus.off(event, this.refresh, this);
    this.element.remove();
    this.tooltip.destroy();
  }
}

function formatCost(cost: BuildingCost): string {
  const parts = (Object.entries(cost) as [ItemId, number][]).map(([id, amount]) => `${amount} ${getItemDef(id).name}`);
  return parts.length ? `Cost: ${parts.join(', ')}` : 'Free';
}
