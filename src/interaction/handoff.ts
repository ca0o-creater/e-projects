import { handoffConfig as config } from '../config/handoff.ts';
import type { SemanticInput, StagePoint } from '../input/semantic.ts';
import { distance, HandoffCurve } from './curve.ts';

export type HandoffState = 'intro' | 'offering' | 'ready' | 'dragging' | 'snapped' | 'returning' | 'completing' | 'complete';
const ease = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// 无 DOM / Pixi / PointerEvent 依赖：核心只接收 GRAB、MOVE、RELEASE。
export class HandoffController {
  state: HandoffState = 'intro';
  progress = 0;
  offerProgress = 0;
  armProgress = 0;
  completionProgress = 0;
  private clock = 0;
  private from = 0;
  private retry = false;
  private emitted = false;
  private curve: HandoffCurve | null = null;
  private readonly handAt: (progress: number) => StagePoint;
  private readonly onComplete: () => void;

  constructor(handAt: (progress: number) => StagePoint, onComplete: () => void) {
    this.handAt = handAt;
    this.onComplete = onComplete;
  }

  get point(): StagePoint { return this.curve?.at(this.progress) ?? { x: 0, y: 0 }; }
  get message(): string {
    switch (this.state) {
      case 'intro': return '';
      case 'snapped': return '已接住，可以松手了';
      case 'returning': return '请重新尝试';
      case 'completing': return '交接成功';
      case 'complete': return '凡间地点已解锁';
      default: return this.retry ? '请重新尝试' : '拖动发光的药瓶，交给后羿';
    }
  }

  prepare(): void { if (this.state === 'intro') this.transition('offering'); }
  setPath(start: StagePoint): void {
    if (this.curve) return;
    this.curve = new HandoffCurve(start, config.controlPoints[0], config.controlPoints[1], this.handAt(1));
  }
  canGrab(point: StagePoint): boolean {
    return this.state === 'ready' && this.curve !== null && distance(point, this.point) <= config.grabRadius;
  }

  readonly input = (event: SemanticInput): void => {
    if (event.type === 'GRAB' && this.canGrab(event.point)) {
      this.retry = false;
      this.transition('dragging');
    } else if (event.type === 'MOVE' && this.state === 'dragging' && this.curve) {
      this.progress = this.curve.project(event.point);
      this.armProgress = this.progress;
      if (distance(this.point, this.handAt(this.progress)) <= config.snapRadius) this.transition('snapped');
    } else if (event.type === 'RELEASE') {
      if (this.state === 'snapped' && !event.cancelled) this.transition('completing');
      else if (this.state === 'dragging' || this.state === 'snapped') {
        this.retry = true;
        this.transition('returning');
      }
    }
  };

  assist(): void {
    if (this.curve && ['ready', 'dragging', 'snapped', 'returning'].includes(this.state)) this.transition('completing');
  }

  private transition(state: HandoffState): void { this.state = state; this.clock = 0; this.from = this.progress; }

  update(dt: number): void {
    this.clock += Math.max(0, dt);
    if (this.state === 'offering') {
      this.offerProgress = ease(this.clock / config.offering.duration);
      if (this.offerProgress === 1 && this.curve) this.transition('ready');
    } else if (this.state === 'snapped') {
      this.progress = this.from + (1 - this.from) * ease(this.clock / config.snapDuration);
      this.armProgress = this.progress;
    } else if (this.state === 'returning') {
      this.progress = this.from * (1 - ease(this.clock / config.returnDuration));
      this.armProgress = this.progress;
      if (this.clock >= config.returnDuration) this.transition('ready');
    } else if (this.state === 'completing') {
      this.progress = this.from + (1 - this.from) * ease(this.clock / config.snapDuration);
      this.completionProgress = Math.max(0, Math.min(1, (this.clock - config.snapDuration) / config.retractDuration));
      this.armProgress = this.progress * (1 - ease(this.completionProgress));
      if (this.completionProgress === 1) {
        this.transition('complete');
        if (!this.emitted) { this.emitted = true; this.onComplete(); }
      }
    }
  }
}
