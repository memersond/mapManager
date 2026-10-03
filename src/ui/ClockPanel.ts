import { EventBus } from '../core/EventBus';
import { GAME_EVENTS } from '../core/GameEvents';
import type { ClockStateChangedPayload, GameClock, TickPayload } from '../time/GameClock';

const PAUSED_CLASS = 'clock-panel--paused';

export class ClockPanel {
  private element: HTMLDivElement;
  private status: HTMLSpanElement;
  private button: HTMLButtonElement;
  private state: ClockStateChangedPayload = { started: false, paused: false, tick: 0 };

  constructor(private clock: GameClock) {
    this.element = document.createElement('div');
    this.element.className = 'clock-panel';

    this.status = document.createElement('span');
    this.status.className = 'clock-panel__status';

    this.button = document.createElement('button');
    this.button.className = 'clock-panel__button';
    this.button.title = 'Pause / resume (Space)';
    // Keep focus off the button so Space doesn't also trigger a click.
    this.button.addEventListener('mousedown', (event) => event.preventDefault());
    this.button.addEventListener('click', () => this.clock.togglePause());

    this.element.append(this.button, this.status);
    document.body.appendChild(this.element);

    EventBus.on(GAME_EVENTS.CLOCK_STATE_CHANGED, this.onStateChanged, this);
    EventBus.on(GAME_EVENTS.TICK, this.onTick, this);
    this.render();
  }

  private onStateChanged(state: ClockStateChangedPayload) {
    this.state = state;
    this.render();
  }

  private onTick({ tick }: TickPayload) {
    this.state = { ...this.state, tick };
    this.render();
  }

  private render() {
    const { started, paused, tick } = this.state;
    this.button.hidden = !started;
    this.button.textContent = paused ? '▶' : '⏸';
    this.element.classList.toggle(PAUSED_CLASS, paused);
    if (!started) this.status.textContent = 'Place a city to begin';
    else this.status.textContent = paused ? `Tick ${tick} · Paused` : `Tick ${tick}`;
  }

  destroy() {
    EventBus.off(GAME_EVENTS.CLOCK_STATE_CHANGED, this.onStateChanged, this);
    EventBus.off(GAME_EVENTS.TICK, this.onTick, this);
    this.element.remove();
  }
}
