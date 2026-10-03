const ANCHOR_GAP = 8;

export type TooltipSide = 'right' | 'top';

export class HoverTooltip {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'hover-tooltip';
    this.element.hidden = true;
    document.body.appendChild(this.element);
  }

  // Shows the tooltip whenever the pointer is over target. html is rebuilt on each hover so it stays current.
  attach(target: HTMLElement, side: TooltipSide, html: () => string) {
    target.addEventListener('mouseenter', () => this.show(target, side, html()));
    target.addEventListener('mouseleave', () => this.hide());
  }

  show(anchor: HTMLElement, side: TooltipSide, html: string) {
    this.element.innerHTML = html;
    this.element.hidden = false;

    const rect = anchor.getBoundingClientRect();
    const { offsetWidth, offsetHeight } = this.element;
    const left = side === 'right' ? rect.right + ANCHOR_GAP : rect.left + (rect.width - offsetWidth) / 2;
    const top = side === 'right' ? rect.top + (rect.height - offsetHeight) / 2 : rect.top - ANCHOR_GAP - offsetHeight;
    this.element.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, top)}px)`;
  }

  hide() {
    this.element.hidden = true;
  }

  destroy() {
    this.element.remove();
  }
}
