export function formatAmount(amount: number): string {
  return Math.floor(amount).toLocaleString();
}

export function formatRate(rate: number): string {
  return rate.toLocaleString(undefined, { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
}

export function rateClass(rate: number): string {
  if (rate > 0) return 'flow--positive';
  return rate < 0 ? 'flow--negative' : '';
}

export function formatLine(label: string, value: string, valueClass = ''): string {
  return `
    <div class="hover-tooltip__flow">
      <span>${label}</span>
      <span class="${valueClass}">${value}</span>
    </div>
  `;
}
