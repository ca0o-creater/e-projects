import { gestureConfig as config } from '../config/gesture.config.ts';
import { OneEuroFilter } from './one-euro.ts';
import type { GestureInput } from './gesture-semantics.ts';
import type { StagePoint } from './semantic.ts';
import { clampStage, mapHandToStage, relativeTarget, type CaptureGestureTarget, type GestureTarget } from './gesture-mapping.ts';

export interface Landmark { x: number; y: number }
export interface HandCursor { point: StagePoint; grabbing: boolean; available: boolean; insideRoi: boolean }

/** Pure landmark -> semantic event adapter. No DOM, renderer or story state. */
export class PinchController {
  private readonly send: (event: GestureInput) => void;
  private readonly canGrab: (point: StagePoint) => boolean;
  private readonly x = new OneEuroFilter(config.filter);
  private readonly y = new OneEuroFilter(config.filter);
  private lastSeen: number | null = null;
  private openSeen = false;
  private closed = false;
  private grabbing = false;
  private candidate: number | null = null;
  private readonly captureTarget?: CaptureGestureTarget;
  private capture: { hand: StagePoint; target: GestureTarget } | null = null;

  constructor(send: (event: GestureInput) => void, canGrab: (point: StagePoint) => boolean, captureTarget?: CaptureGestureTarget) {
    this.send = send; this.canGrab = canGrab; this.captureTarget = captureTarget;
  }

  cancel(): void {
    const wasGrabbing = this.grabbing;
    this.grabbing = this.closed = this.openSeen = false;
    this.candidate = this.lastSeen = null;
    this.capture = null;
    this.x.reset(); this.y.reset();
    if (wasGrabbing) this.send({ type: 'GRAB_END', cancelled: true });
  }

  missing(now: number): void {
    if (this.lastSeen !== null && now - this.lastSeen >= config.lostHandMs) this.cancel();
    this.candidate = null; // 连续捏合确认不能跨越丢帧。
  }

  update(landmarks: readonly Landmark[] | undefined, now: number, aspect = 1): HandCursor | null {
    const a = landmarks?.[4], b = landmarks?.[8], palmA = landmarks?.[5], palmB = landmarks?.[17];
    if (!a || !b || !palmA || !palmB || ![a,b,palmA,palmB].every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) {
      this.missing(now); return null;
    }
    // Also enforce timeout when the next valid frame arrives after a stalled camera.
    if (this.lastSeen !== null && now - this.lastSeen >= config.lostHandMs) this.cancel();
    const nx = (a.x + b.x) / 2, ny = (a.y + b.y) / 2;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) { this.missing(now); return null; }
    const dist = (p: Landmark, q: Landmark) => Math.hypot((p.x-q.x)*aspect, p.y-q.y);
    const palm = dist(palmA,palmB);
    if (palm < 0.025) { this.missing(now); return null; }
    this.lastSeen = now;
    const mapped = mapHandToStage({x:nx,y:ny});
    const hand = {
      x: this.x.update(mapped.point.x, now),
      y: this.y.update(mapped.point.y, now),
    };
    let point = this.capture ? relativeTarget(hand,this.capture.hand,this.capture.target) : clampStage(hand);
    const ratio = dist(a,b)/palm;
    if (ratio >= config.pinch.open) {
      if (this.grabbing) {
        this.send({ type: 'CONTROL_UPDATE', point });
        this.grabbing = false;
        this.capture = null;
        this.send({ type: 'GRAB_END' });
      }
      this.openSeen = true; this.closed = false; this.candidate = null;
    } else if (ratio <= config.pinch.close && !this.closed && this.openSeen) {
      this.candidate ??= now;
      if (now - this.candidate >= config.pinch.confirmMs) {
        this.closed = true; this.candidate = null;
        if (mapped.inside && this.canGrab(point)) {
          const target = this.captureTarget ? this.captureTarget() : { point:{...point}, constrain:clampStage };
          if (!target) return { point, grabbing:false, available:false, insideRoi:mapped.inside };
          this.capture = { hand:{...hand}, target:{point:{...target.point},constrain:target.constrain} };
          point = {...target.point}; // 第一帧始终保留瓶子原位，不能跳到指尖。
          this.grabbing = true;
          this.send({ type: 'GRAB_START', point });
        }
      }
    } else if (ratio > config.pinch.close) this.candidate = null;
    if (this.grabbing) this.send({ type: 'CONTROL_UPDATE', point });
    return { point, grabbing: this.grabbing, available: mapped.inside && this.canGrab(point), insideRoi:mapped.inside };
  }
}
