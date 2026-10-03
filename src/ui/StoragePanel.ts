import Phaser from 'phaser';
import { ATLAS_KEY, spriteFrame } from '../assets/SpriteAtlas';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { FlowEntry, FlowsChangedPayload, ItemFlows } from '../economy/EconomySystem';
import type { LogisticsSystem } from '../logistics/LogisticsSystem';
import { ITEM_DEFS, type ItemDef, type ItemId } from '../storage/items';
import type { StorageChangedPayload } from '../storage/Storage';
import { formatAmount, formatLine, formatRate, rateClass } from './format';
import { HoverTooltip } from './HoverTooltip';

// The rate beside each amount is the average change in city stock over this many ticks.
// Measured rather than derived from flows, since hauling delays and construction spending make flows misleading.
const RATE_WINDOW_TICKS = 20;

// Shows goods stored across all cities. Goods at work sites or carried by haulers only appear in the tooltip.
export class StoragePanel {
  private element: HTMLDivElement;
  private tooltip = new HoverTooltip();
  private amountElements = new Map<ItemId, HTMLElement>();
  private rateElements = new Map<ItemId, HTMLElement>();
  private history = new Map<ItemId, number[]>();
  private flows: ItemFlows = new Map();

  constructor(scene: Phaser.Scene, private buildings: BuildingSystem, private logistics: LogisticsSystem) {
    this.element = document.createElement('div');
    this.element.className = 'storage-panel';
    for (const def of ITEM_DEFS) this.element.appendChild(this.createRow(scene, def));
    document.body.appendChild(this.element);

    EventBus.on(GAME_EVENTS.STORAGE_CHANGED, this.onStorageChanged, this);
    EventBus.on(GAME_EVENTS.FLOWS_CHANGED, this.onFlowsChanged, this);
    EventBus.on(GAME_EVENTS.TICK, this.onTick, this);
    EventBus.on(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
    this.refreshAmounts();
  }

  private createRow(scene: Phaser.Scene, def: ItemDef): HTMLElement {
    const row = document.createElement('div');
    row.className = 'storage-panel__row';

    const icon = document.createElement('img');
    icon.className = 'storage-panel__icon';
    icon.src = scene.textures.getBase64(ATLAS_KEY, spriteFrame(def.sprite));
    icon.alt = def.name;

    const amountElement = document.createElement('span');
    amountElement.className = 'storage-panel__amount';
    this.amountElements.set(def.id, amountElement);

    const rateElement = document.createElement('span');
    rateElement.className = 'storage-panel__rate';
    this.rateElements.set(def.id, rateElement);

    row.append(icon, amountElement, rateElement);
    this.tooltip.attach(row, 'right', () => {
      const entries = this.flows.get(def.id) ?? [];
      return `
        <div class="hover-tooltip__title">${def.name}</div>
        <div class="hover-tooltip__description">${def.description}</div>
        <div class="hover-tooltip__section">Stock</div>
        ${formatLine('In cities', formatAmount(this.buildings.getStored(def.id)))}
        ${formatLine('At work sites', formatAmount(this.logistics.getAtSites(def.id)))}
        ${formatLine('Being hauled', formatAmount(this.logistics.getInTransit(def.id)))}
        ${formatFlowSection('Producers', entries.filter((entry) => entry.amount > 0))}
        ${formatFlowSection('Consumers', entries.filter((entry) => entry.amount < 0))}
      `;
    });
    return row;
  }

  private onStorageChanged({ itemId }: StorageChangedPayload) {
    this.amountElements.get(itemId)!.textContent = formatAmount(this.buildings.getStored(itemId));
  }

  private refreshAmounts() {
    for (const [itemId, element] of this.amountElements) {
      element.textContent = formatAmount(this.buildings.getStored(itemId));
    }
  }

  private onTick() {
    for (const [itemId, rateElement] of this.rateElements) {
      const history = this.history.get(itemId) ?? [];
      history.push(this.buildings.getStored(itemId));
      if (history.length > RATE_WINDOW_TICKS + 1) history.shift();
      this.history.set(itemId, history);

      const rate = history.length > 1 ? (history[history.length - 1] - history[0]) / (history.length - 1) : 0;
      rateElement.textContent = Math.abs(rate) >= 0.05 ? formatRate(rate) : '';
      rateElement.className = `storage-panel__rate ${rateClass(rate)}`;
    }
  }

  private onFlowsChanged({ flows }: FlowsChangedPayload) {
    this.flows = flows;
  }

  private onMapGenerated() {
    this.history.clear();
    for (const rateElement of this.rateElements.values()) rateElement.textContent = '';
    this.refreshAmounts();
  }

  destroy() {
    EventBus.off(GAME_EVENTS.STORAGE_CHANGED, this.onStorageChanged, this);
    EventBus.off(GAME_EVENTS.FLOWS_CHANGED, this.onFlowsChanged, this);
    EventBus.off(GAME_EVENTS.TICK, this.onTick, this);
    EventBus.off(GAME_EVENTS.MAP_GENERATED, this.onMapGenerated, this);
    this.element.remove();
    this.tooltip.destroy();
  }
}

function formatFlowSection(title: string, entries: FlowEntry[]): string {
  if (!entries.length) return '';
  const lines = entries.map(({ label, amount }) => formatLine(label, formatRate(amount), rateClass(amount))).join('');
  return `<div class="hover-tooltip__section">${title} (per tick)</div>${lines}`;
}
