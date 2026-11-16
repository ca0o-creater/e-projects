/** One Euro: low speed suppresses jitter; high speed reduces lag. Time in ms. */
export class OneEuroFilter {
  private previous: number | undefined;
  private filtered = 0;
  private derivative = 0;
  private time = 0;
  private readonly options: { minCutoff: number; beta: number; derivativeCutoff: number };

  constructor(options: { minCutoff: number; beta: number; derivativeCutoff: number }) {
    this.options = options;
  }
  reset(): void { this.previous = undefined; }
  update(value: number, now: number): number {
    if (this.previous === undefined) {
      this.previous = this.filtered = value; this.time = now; this.derivative = 0;
      return value;
    }
    if (now <= this.time) return this.filtered;
    const dt = Math.max(0.001, (now - this.time) / 1000);
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    this.derivative += alpha(this.options.derivativeCutoff) * ((value - this.previous) / dt - this.derivative);
    this.filtered += alpha(this.options.minCutoff + this.options.beta * Math.abs(this.derivative)) * (value - this.filtered);
    this.previous = value; this.time = now;
    return this.filtered;
  }
}
