import type { StagePoint } from '../input/semantic.ts';

export const distance = (a: StagePoint, b: StagePoint): number => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (a: StagePoint, b: StagePoint, t: number): StagePoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// 三次贝塞尔预采样，进度按弧长归一化；拖动采用最近点投影，返回也沿同一路径。
export class HandoffCurve {
  private readonly samples: { point: StagePoint; length: number }[] = [];
  readonly length: number;

  constructor(start: StagePoint, control1: StagePoint, control2: StagePoint, end: StagePoint) {
    let length = 0;
    for (let i = 0; i <= 240; i++) {
      const t = i / 240, u = 1 - t;
      const point = { x: u ** 3 * start.x + 3 * u ** 2 * t * control1.x + 3 * u * t ** 2 * control2.x + t ** 3 * end.x,
        y: u ** 3 * start.y + 3 * u ** 2 * t * control1.y + 3 * u * t ** 2 * control2.y + t ** 3 * end.y };
      if (i) length += distance(point, this.samples[i - 1].point);
      this.samples.push({ point, length });
    }
    this.length = length;
  }

  at(progress: number): StagePoint {
    const length = Math.max(0, Math.min(1, progress)) * this.length;
    const index = this.samples.findIndex(sample => sample.length >= length);
    if (index <= 0) return { ...this.samples[0].point };
    const a = this.samples[index - 1], b = this.samples[index];
    return mix(a.point, b.point, (length - a.length) / (b.length - a.length || 1));
  }

  project(point: StagePoint): number {
    let bestDistance = Infinity, progress = 0;
    for (let i = 1; i < this.samples.length; i++) {
      const a = this.samples[i - 1], b = this.samples[i];
      const dx = b.point.x - a.point.x, dy = b.point.y - a.point.y;
      const t = Math.max(0, Math.min(1, ((point.x - a.point.x) * dx + (point.y - a.point.y) * dy) / (dx * dx + dy * dy || 1)));
      const d = distance(point, mix(a.point, b.point, t));
      if (d < bestDistance) {
        bestDistance = d;
        progress = (a.length + (b.length - a.length) * t) / (this.length || 1);
      }
    }
    return progress;
  }
}
