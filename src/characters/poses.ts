import { charactersConfig as actors } from '../config/characters.ts';
import { handoffConfig } from '../config/handoff.ts';

export function receivingPose(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  return {
    shoulder: actors.houyi.upperArm.rotation + (handoffConfig.receivePose.shoulder - actors.houyi.upperArm.rotation) * p,
    elbow: actors.houyi.forearm.rotation + (handoffConfig.receivePose.elbow - actors.houyi.forearm.rotation) * p,
  };
}

// 与骨架相同的正向运动学，得到药瓶底部落在手心时的圆心坐标。
export function receivingHand(progress: number) {
  const c = actors.houyi;
  const { shoulder, elbow } = receivingPose(progress);
  const angle = shoulder + elbow;
  const x = c.shoulder.x - Math.sin(shoulder) * c.upperArm.length
    - Math.sin(angle) * c.forearm.length;
  const y = c.shoulder.y + Math.cos(shoulder) * c.upperArm.length
    + Math.cos(angle) * c.forearm.length;
  return { x: c.x + x * c.scale, y: c.y + y * c.scale - actors.bottle.radius };
}
