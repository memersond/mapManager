// Binary min-heap of values keyed by a numeric priority.
export class MinHeap<T> {
  private values: T[] = [];
  private priorities: number[] = [];

  get size(): number {
    return this.values.length;
  }

  push(value: T, priority: number) {
    this.values.push(value);
    this.priorities.push(priority);
    this.siftUp(this.values.length - 1);
  }

  pop(): T | undefined {
    if (!this.values.length) return undefined;
    const top = this.values[0];
    const lastValue = this.values.pop()!;
    const lastPriority = this.priorities.pop()!;
    if (this.values.length) {
      this.values[0] = lastValue;
      this.priorities[0] = lastPriority;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.priorities[parent] <= this.priorities[i]) return;
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(i: number) {
    const length = this.values.length;
    for (;;) {
      const left = i * 2 + 1;
      const right = left + 1;
      let smallest = i;
      if (left < length && this.priorities[left] < this.priorities[smallest]) smallest = left;
      if (right < length && this.priorities[right] < this.priorities[smallest]) smallest = right;
      if (smallest === i) return;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number) {
    [this.values[a], this.values[b]] = [this.values[b], this.values[a]];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b], this.priorities[a]];
  }
}
