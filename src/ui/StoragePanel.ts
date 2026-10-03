import Phaser from 'phaser';
import { ATLAS_KEY, spriteFrame } from '../assets/SpriteAtlas';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { netFlow, type FlowEntry, type FlowsChangedPayload, type ItemFlows } from '../economy/EconomySystem';
import { ITEM_DEFS, type ItemDef, type ItemId } from '../storage/items';
import type { Storage, StorageChangedPayload } from '../storage/Storage';
import { HoverTooltip } from './HoverTooltip';

export class StoragePanel {
  private element: HTMLDivElement;
  private tooltip = new HoverTooltip();
  private amountElements = new Map<ItemId, HTMLElement>();
  private rateElements = new Map<ItemId, HTMLElement>();
  private flows: ItemFlows = new Map();

  constructor(scene: Phaser.Scene, storage: Storage) {
    this.element = document.createElement('div');
    this.element.className = 'storage-panel';

    for (const def of ITEM_DEFS) {
      this.element.appendChild(this.createRow(scene, def, storage.get(def.id)));
    }

    document.body.appendChild(this.element);
    EventBus.on(GAME_EVENTS.STORAGE_CHANGED, this.onStorageChanged, this);
    EventBus.on(GAME_EVENTS.FLOWS_CHANGED, this.onFlowsChanged, this);
  }

  private createRow(scene: Phaser.Scene, def: ItemDef, amount: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'storage-panel__row';

    const icon = document.createElement('img');
    icon.className = 'storage-panel__icon';
    icon.src = scene.textures.getBase64(ATLAS_KEY, spriteFrame(def.sprite));
    icon.alt = def.name;

    const amountElement = document.createElement('span');
    amountElement.className = 'storage-panel__amount';
    amountElement.textContent = formatAmount(amount);
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
        ${formatFlowSection('Producers', entries.filter((entry) => entry.amount > 0))}
        ${formatFlowSection('Consumers', entries.filter((entry) => entry.amount < 0))}
      `;
    });
    return row;
  }

  private onStorageChanged({ itemId, amount }: StorageChangedPayload) {
    const amountElement = this.amountElements.get(itemId);
    if (amountElement) amountElement.textContent = formatAmount(amount);
  }

  private onFlowsChanged({ flows }: FlowsChangedPayload) {
    this.flows = flows;
    for (const [itemId, rateElement] of this.rateElements) {
      const net = netFlow(flows.get(itemId) ?? []);
      rateElement.textContent = net ? formatRate(net) : '';
      rateElement.className = `storage-panel__rate ${rateClass(net)}`;
    }
  }

  destroy() {
    EventBus.off(GAME_EVENTS.STORAGE_CHANGED, this.onStorageChanged, this);
    EventBus.off(GAME_EVENTS.FLOWS_CHANGED, this.onFlowsChanged, this);
    this.element.remove();
    this.tooltip.destroy();
  }
}

function formatAmount(amount: number): string {
  return Math.floor(amount).toLocaleString();
}

function formatRate(rate: number): string {
  return rate.toLocaleString(undefined, { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
}

function rateClass(rate: number): string {
  if (rate > 0) return 'flow--positive';
  return rate < 0 ? 'flow--negative' : '';
}

function formatFlowSection(title: string, entries: FlowEntry[]): string {
  if (!entries.length) return '';
  const lines = entries
    .map(({ label, amount }) => `
      <div class="hover-tooltip__flow">
        <span>${label}</span>
        <span class="${rateClass(amount)}">${formatRate(amount)}</span>
      </div>
    `)
    .join('');
  return `<div class="hover-tooltip__section">${title} (per tick)</div>${lines}`;
}
