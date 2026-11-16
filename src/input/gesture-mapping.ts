import { gestureConfig as config } from '../config/gesture.config.ts';
import type { StagePoint } from './semantic.ts';

/** Capture an immutable target position and its constraint at pinch start. */
export interface GestureTarget {
  point: StagePoint;
  constrain: (point: StagePoint) => StagePoint;
}
export type CaptureGestureTarget = () => GestureTarget | null;

export function mirrorPoint(point: StagePoint): StagePoint {
  return { x: config.mirrorX ? 1-point.x : point.x, y: point.y };
}

export function mapHandToStage(point: StagePoint): { point: StagePoint; inside: boolean } {
  const p = mirrorPoint(point), r = config.roi;
  const x = (p.x-r.x)/r.width, y = (p.y-r.y)/r.height;
  // Keep raw overtravel for relative motion; only the idle cursor is clamped.
  return { point: { x:x*config.stage.width, y:y*config.stage.height },
    inside: x>=-1e-9 && x<=1+1e-9 && y>=-1e-9 && y<=1+1e-9 };
}

export function clampStage(point: StagePoint): StagePoint {
  return { x: Math.max(0,Math.min(config.stage.width,point.x)), y: Math.max(0,Math.min(config.stage.height,point.y)) };
}

export function relativeTarget(hand: StagePoint, origin: StagePoint, target: GestureTarget): StagePoint {
  return target.constrain({x:target.point.x+hand.x-origin.x, y:target.point.y+hand.y-origin.y});
}
