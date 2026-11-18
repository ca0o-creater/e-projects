import { prologueConfig as config } from '../config/prologue.config.ts';

const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const ease = (v: number): number => { const t = clamp(v); return t * t * (3 - 2 * t); };

export interface PrologueFrame {
  active: boolean;
  index: number;
  text: string;
  alpha: number;
  backdropAlpha: number;
  skipVisible: boolean;
}

export interface WalkFrame {
  x: number;
  y: number;
  height: number;
  scale: number;
  alpha: number;
  progress: number;
}

// 纯函数：只按播放时间给出该帧的旁白文字与透明度、跳过按钮状态。
export function prologueAt(seconds: number): PrologueFrame {
  const s = config.subtitle, t = Math.max(0, seconds), duration = config.duration;
  const active = t < duration;
  const index = Math.min(config.lines.length - 1, Math.floor(t / config.step));
  const local = t - index * config.step;
  const lineEnd = s.in + s.hold + s.out;
  const alpha = local >= lineEnd ? 0
    : local < s.in ? ease(local / s.in)
    : local < s.in + s.hold ? 1
    : 1 - ease((local - s.in - s.hold) / s.out);
  const backdropFade = ease(clamp((duration - t) / s.backdrop.fadeOut));
  return {
    active,
    index,
    text: config.lines[index],
    alpha: active ? alpha : 0,
    backdropAlpha: active ? backdropFade : 0,
    skipVisible: active && t >= config.skip.appearAt,
  };
}

// 后羿走向山门：旁白 9 秒内从右下角移动到山门，尺寸缩到 30%、透明度降到 0.5。
// 位置、尺寸、透明度都用同一个缓动，避免出现“先变小再走”的割裂感。
export function houyiWalkAt(seconds: number): WalkFrame {
  const w = config.houyiWalk, duration = config.duration;
  const walking = Math.max(0, Math.min(seconds, duration));
  const progress = ease(walking / duration);
  const height = w.start.height + (w.end.height - w.start.height) * progress;
  // 脚步起伏用线性时间计算，节奏均匀；旁白结束后停住，便于暗场接第一幕。
  const stepPhase = (walking / duration) * Math.PI * 2 * w.bob.cycles;
  const bob = seconds < duration
    ? Math.sin(stepPhase) * w.bob.amplitude * (height / w.start.height) : 0;
  return {
    x: w.start.x + (w.end.x - w.start.x) * progress,
    y: w.start.y + (w.end.y - w.start.y) * progress + bob,
    height,
    scale: height / w.crop.height,
    alpha: w.start.alpha + (w.end.alpha - w.start.alpha) * progress,
    progress,
  };
}

// 旁白播完后整体压黑，供切换到第一幕使用。
export function prologueBlackout(seconds: number): number {
  const start = config.duration, fade = config.transition.fadeToBlack;
  if (seconds <= start) return 0;
  return ease((seconds - start) / fade);
}

// 切到第一幕后的亮起曲线：elapsed=0 仍是全黑，0.5 秒后完全恢复。
export function prologueFadeIn(elapsed: number): number {
  return 1 - ease(Math.max(0, elapsed) / config.transition.fadeFromBlack);
}
