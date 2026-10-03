import type { BuildingSelectedPayload } from '../buildings/BuildingSelection';
import type { Building, BuildingSystem } from '../buildings/BuildingSystem';
import type { ConstructionSystem } from '../buildings/ConstructionSystem';
import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { EconomySystem, StaffRole } from '../economy/EconomySystem';
import { SITE_STOCK_CAPACITY } from '../logistics/logistics';
import type { Hauler, LogisticsSystem } from '../logistics/LogisticsSystem';
import type { RouteNetwork } from '../logistics/RouteNetwork';
import { getItemDef, ITEM_DEFS, itemEntries } from '../storage/items';
import { formatAmount, formatLine, formatRate } from './format';

// Shift-click on +/- changes staff by this much.
const STAFF_BIG_STEP = 5;

const REFRESH_EVENTS = [GAME_EVENTS.TICK, GAME_EVENTS.STAFFING_CHANGED, GAME_EVENTS.BUILDING_COMPLETED];

interface StaffRow {
  element: HTMLElement;
  value: HTMLSpanElement;
}

// Details for the selected building: staffing controls, site stock and route for producers,
// inventory and wants for cities, and what a queued site still needs.
export class BuildingPanel {
  private element: HTMLDivElement;
  private title: HTMLDivElement;
  private info: HTMLDivElement;
  private staff: HTMLDivElement;
  private staffRows: Record<StaffRole, StaffRow>;
  private available: HTMLDivElement;
  private details: HTMLDivElement;
  private cancelButton: HTMLButtonElement;
  private building: Building | null = null;

  constructor(
    private buildings: BuildingSystem,
    private economy: EconomySystem,
    private construction: ConstructionSystem,
    private logistics: LogisticsSystem,
    private routes: RouteNetwork,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'building-panel';
    this.element.hidden = true;

    const header = document.createElement('div');
    header.className = 'building-panel__header';
    this.title = document.createElement('div');
    this.title.className = 'building-panel__title';
    const close = createButton('×', 'building-panel__close', () => this.emitSelected(null));
    header.append(this.title, close);

    this.info = document.createElement('div');
    this.staff = document.createElement('div');
    this.staff.className = 'building-panel__staff';
    this.staffRows = { workers: this.createStaffRow('workers', 'Workers'), haulers: this.createStaffRow('haulers', 'Haulers') };
    this.available = document.createElement('div');
    this.available.className = 'building-panel__hint';
    this.staff.append(this.staffRows.workers.element, this.staffRows.haulers.element, this.available);
    this.details = document.createElement('div');
    this.cancelButton = createButton('Cancel construction', 'building-panel__cancel', () => {
      if (this.building) this.buildings.cancel(this.building);
    });

    this.element.append(header, this.info, this.staff, this.details, this.cancelButton);
    document.body.appendChild(this.element);

    EventBus.on(GAME_EVENTS.BUILDING_SELECTED, this.onSelected, this);
    for (const event of REFRESH_EVENTS) EventBus.on(event, this.render, this);
  }

  private createStaffRow(role: StaffRole, label: string): StaffRow {
    const element = document.createElement('div');
    element.className = 'building-panel__staff-row';
    const labelElement = document.createElement('span');
    labelElement.textContent = label;
    const value = document.createElement('span');
    value.className = 'building-panel__staff-value';
    const change = (direction: number) => (event: MouseEvent) => {
      const building = this.building;
      if (!building) return;
      const step = event.shiftKey ? STAFF_BIG_STEP : 1;
      this.economy.setStaff(building, role, building[role] + direction * step);
    };
    const minus = createButton('−', 'building-panel__step', change(-1));
    const plus = createButton('+', 'building-panel__step', change(1));
    minus.title = plus.title = `Shift-click for ${STAFF_BIG_STEP}`;
    element.append(labelElement, minus, value, plus);
    return { element, value };
  }

  private onSelected({ building }: BuildingSelectedPayload) {
    this.building = building;
    this.render();
  }

  private emitSelected(building: Building | null) {
    const payload: BuildingSelectedPayload = { building };
    EventBus.emit(GAME_EVENTS.BUILDING_SELECTED, payload);
  }

  private render() {
    const building = this.building;
    this.element.hidden = !building;
    if (!building) return;

    const queued = building.status === 'queued';
    this.title.textContent = building.name;
    this.cancelButton.hidden = !queued;
    this.staff.hidden = queued;
    if (queued) {
      this.info.innerHTML = '<div class="building-panel__hint">Under construction</div>';
      this.details.innerHTML = this.formatConstruction(building);
      return;
    }

    this.renderStaff(building);
    if (building.def.storesGoods) {
      this.info.innerHTML = `<div class="building-panel__hint">Population ${building.population}</div>`;
      this.details.innerHTML = this.formatStore(building);
    } else {
      this.info.innerHTML = '';
      this.details.innerHTML = this.formatProducer(building);
    }
  }

  private renderStaff(building: Building) {
    const { workers, haulers } = this.staffRows;
    workers.element.hidden = building.jobs === 0;
    workers.value.textContent = `${building.workers} / ${building.jobs}`;
    haulers.element.hidden = building.def.maxHaulers === 0;
    haulers.value.textContent = `${building.haulers} / ${building.def.maxHaulers}`;
    this.available.textContent = `${this.economy.getAvailable()} citizens available`;
  }

  private formatConstruction(site: Building): string {
    const payer = this.construction.getPayer(site);
    if (!payer) return '';
    const lines = itemEntries(site.cost).map(([itemId, amount]) => {
      const have = payer.storage.get(itemId);
      const short = have < amount ? 'flow--negative' : 'flow--positive';
      return formatLine(getItemDef(itemId).name, `${formatAmount(have)} / ${amount}`, short);
    });
    return `
      <div class="hover-tooltip__section">Paid by ${payer.name}</div>
      ${lines.join('')}
    `;
  }

  private formatProducer(building: Building): string {
    const produced = itemEntries(building.def.production).map(([itemId, amount]) =>
      formatLine(`${getItemDef(itemId).name} produced`, `${formatRate(amount * building.workers)} / tick`),
    );
    const route = this.routes.routeToStore(building);
    const production = itemEntries(building.def.production).reduce((sum, [, amount]) => sum + amount * building.workers, 0);
    const haulRate = this.logistics.getHaulRate(building);
    const busy = this.logistics.getHaulers(building).filter((hauler) => hauler.phase !== 'idle').length;

    return `
      ${produced.join('')}
      ${formatLine('Awaiting pickup', `${formatAmount(building.storage.total())} / ${SITE_STOCK_CAPACITY}`)}
      <div class="hover-tooltip__section">Hauling</div>
      ${route ? formatLine('Delivers to', route.to.name) : formatLine('Delivers to', 'Unreachable', 'flow--negative')}
      ${route ? formatLine('Trip', `${route.ticks} ticks each way`) : ''}
      ${formatLine('Capacity', `${formatRate(haulRate)} / tick`, haulRate < production ? 'flow--negative' : '')}
      ${formatLine('On the road', `${busy} / ${building.haulers}`)}
    `;
  }

  private formatStore(store: Building): string {
    const targets = this.logistics.getTargets(store);
    const inventory = ITEM_DEFS.map((def) => {
      const have = store.storage.get(def.id);
      const wanted = (targets.construction[def.id] ?? 0) + (targets.base[def.id] ?? 0);
      return formatLine(def.name, wanted ? `${formatAmount(have)} / ${formatAmount(wanted)}` : formatAmount(have),
        have < wanted ? 'flow--negative' : '');
    });
    const trips = this.logistics
      .getHaulers(store)
      .filter((hauler) => hauler.phase !== 'idle')
      .map(formatTrip);

    return `
      <div class="hover-tooltip__section">Inventory (have / want)</div>
      ${inventory.join('')}
      <div class="hover-tooltip__section">Haulers out</div>
      ${trips.length ? trips.join('') : '<div class="building-panel__hint">None</div>'}
    `;
  }

  destroy() {
    EventBus.off(GAME_EVENTS.BUILDING_SELECTED, this.onSelected, this);
    for (const event of REFRESH_EVENTS) EventBus.off(event, this.render, this);
    this.element.remove();
  }
}

function formatTrip(hauler: Hauler): string {
  const eta = `${hauler.ticksLeft} ticks`;
  if (hauler.fetch) {
    const { itemId, amount, source } = hauler.fetch;
    return formatLine(`Fetching ${formatAmount(amount)} ${getItemDef(itemId).name} from ${source.name}`, eta);
  }
  const cargo = itemEntries(hauler.cargo).map(([itemId, amount]) => `${formatAmount(amount)} ${getItemDef(itemId).name}`);
  return formatLine(`Bringing ${cargo.join(', ') || 'nothing'} home`, eta);
}

// Buttons never take focus, so Space (pause) doesn't re-click them.
function createButton(text: string, className: string, onClick: (event: MouseEvent) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.textContent = text;
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', onClick);
  return button;
}
