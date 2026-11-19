export type ActOnePhase = 'establishing' | 'title-enter' | 'title-hold' | 'title-exit' | 'ambient';

export interface TitleTiming {
  delay: number;
  enter: number;
  hold: number;
  exit: number;
}

// 纯时间轴：只由场景累计的播放时间驱动，暂停期间不计时。
export function sampleTitle(seconds: number, timing: TitleTiming) {
  const t = seconds - timing.delay;
  if (t < 0) return { phase: 'establishing' as ActOnePhase, progress: 0, alpha: 0 };
  if (t < timing.enter) {
    const progress = 1 - (1 - t / timing.enter) ** 3;
    return { phase: 'title-enter' as ActOnePhase, progress, alpha: progress };
  }
  if (t < timing.enter + timing.hold) {
    return { phase: 'title-hold' as ActOnePhase, progress: 1, alpha: 1 };
  }
  if (t < timing.enter + timing.hold + timing.exit) {
    const progress = (t - timing.enter - timing.hold) / timing.exit;
    return { phase: 'title-exit' as ActOnePhase, progress: 1, alpha: 1 - progress };
  }
  return { phase: 'ambient' as ActOnePhase, progress: 1, alpha: 0 };
}

export function cloudOffset(seconds: number, speed: number, period: number): number {
  return -((seconds * speed) % period);
}
