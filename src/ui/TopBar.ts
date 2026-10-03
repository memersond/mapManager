import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { WorkforceChangedPayload } from '../economy/EconomySystem';

export class TopBar {
  private element: HTMLDivElement;
  private citizens: HTMLSpanElement;
  private available: HTMLSpanElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'top-bar';
    this.citizens = this.addStat('Citizens', 'Total population across all cities.');
    this.available = this.addStat('Available workers', 'Citizens without a job.');
    document.body.appendChild(this.element);

    EventBus.on(GAME_EVENTS.WORKFORCE_CHANGED, this.onWorkforceChanged, this);
    this.onWorkforceChanged({ population: 0, employed: 0 });
  }

  private addStat(label: string, title: string): HTMLSpanElement {
    const stat = document.createElement('div');
    stat.title = title;
    const labelElement = document.createElement('span');
    labelElement.className = 'top-bar__label';
    labelElement.textContent = label;
    const value = document.createElement('span');
    stat.append(labelElement, value);
    this.element.appendChild(stat);
    return value;
  }

  private onWorkforceChanged({ population, employed }: WorkforceChangedPayload) {
    this.citizens.textContent = String(population);
    this.available.textContent = String(population - employed);
  }

  destroy() {
    EventBus.off(GAME_EVENTS.WORKFORCE_CHANGED, this.onWorkforceChanged, this);
    this.element.remove();
  }
}
