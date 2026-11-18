import { HandoffCurve, distance } from '../interaction/curve.ts';
import { handoffConfig } from '../config/handoff.ts';
import type { StagePoint } from './semantic.ts';
import type { GestureTarget } from './gesture-mapping.ts';

/** Input-side path snapshot. The original mouse adapter and story are unchanged. */
export function captureHandoffTarget(start: StagePoint, end: StagePoint): GestureTarget {
  const a={...start},b={...end};
  const curve=new HandoffCurve(a,...handoffConfig.controlPoints,b);
  const points=Array.from({length:241},(_,i)=>curve.at(i/240));
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
  const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
  return { point:a, constrain:p=> {
    // Outside the path envelope, stop at the nearest endpoint, never cancel or extrapolate.
    if(p.x<minX || p.x>maxX || p.y<minY || p.y>maxY) return {...(distance(p,a)<distance(p,b)?a:b)};
    return curve.at(curve.project(p));
  }};
}
