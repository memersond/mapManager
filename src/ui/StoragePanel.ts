import Phaser from 'phaser';
import { ATLAS_KEY, spriteFrame } from '../assets/SpriteAtlas';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import { ITEM_DEFS, type ItemDef, type ItemId } from '../storage/items';
import type { Storage, StorageChangedPayload } from '../storage/Storage';

const TOOLTIP_OFFSET = 8;

export class StoragePanel {
  private element: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private amountElements = new Map<ItemId, HTMLElement>();

  constructor(scene: Phaser.Scene, storage: Storage) {
    this.element = document.createElement('div');
    this.element.className = 'storage-panel';

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'storage-tooltip';
    this.tooltip.hidden = true;

    for (const def of ITEM_DEFS) {
      this.element.appendChild(this.createRow(scene, def, storage.get(def.id)));
    }

    document.body.append(this.element, this.tooltip);
    EventBus.on(GAME_EVENTS.STORAGE_CHANGED, this.onStorageChanged, this);
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

    row.append(icon, amountElement);
    row.addEventListener('mouseenter', () => this.showTooltip(row, def));
    row.addEventListener('mouseleave', () => (this.tooltip.hidden = true));
    return row;
  }

  private showTooltip(row: HTMLElement, def: ItemDef) {
    this.tooltip.innerHTML = `
      <div class="storage-tooltip__title">${def.name}</div>
      <div class="storage-tooltip__description">${def.description}</div>
    `;
    this.tooltip.hidden = false;
    const rect = row.getBoundingClientRect();
    const top = rect.top + (rect.height - this.tooltip.offsetHeight) / 2;
    this.tooltip.style.transform = `translate(${rect.right + TOOLTIP_OFFSET}px, ${top}px)`;
  }

  private onStorageChanged({ itemId, amount }: StorageChangedPayload) {
    const amountElement = this.amountElements.get(itemId);
    if (amountElement) amountElement.textContent = formatAmount(amount);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.STORAGE_CHANGED, this.onStorageChanged, this);
    this.element.remove();
    this.tooltip.remove();
  }
}

function formatAmount(amount: number): string {
  return Math.floor(amount).toLocaleString();
}
