import type { SwallowController } from '../interaction/swallow.ts';
import type { AscentController } from '../interaction/ascent.ts';
import { ascentDragDistance, ascentPoseAt } from '../scenes/ascent-pose.ts';
import { gestureConfig } from '../config/gesture.config.ts';
import {actTwoConfig} from '../config/act-two.ts';
import {scene3Config} from '../config/scene3.config.ts';
import type { GestureTarget } from './gesture-mapping.ts';
const clamp=(p:number)=>Math.max(0,Math.min(1,p));

// Capture progress once. Both mappings ignore horizontal hand displacement.
export function captureSwallowTarget(controller:SwallowController):GestureTarget|null {
  if(controller.state!=='ready')return null;
  const point={...controller.point},from=controller.progress;
  return {point,holdInfo:()=>({distance:controller.targetDistance,radius:actTwoConfig.arm.stableRadius,progress:controller.holdProgress}),constrain:p=>controller.pointAt(clamp(from+(point.y-p.y)/gestureConfig.swallow.liftDistance))};
}
export function captureAscentTarget(controller:AscentController):GestureTarget|null {
  if(controller.state!=='ready'||controller.assisting)return null;
  const point={...controller.point},from=controller.progress;
  return {point,holdInfo:()=>({distance:controller.targetDistance,radius:scene3Config.control.stableRadius,progress:Math.min(1,controller.hold/scene3Config.control.holdSeconds)}),constrain:p=>ascentPoseAt(clamp(from+(point.y-p.y)/ascentDragDistance)).point};
}
