import type { StagePoint } from '../input/semantic.ts';

// 屏幕坐标 +Y 向下，骨骼以 +Y 为零角。选择肘部 Y 更大的分支。
export function solveTwoBone(target: StagePoint, l1: number, l2: number) {
  if (![target.x,target.y,l1,l2].every(Number.isFinite) || l1 <= 0 || l2 <= 0) return null;
  const d = Math.hypot(target.x,target.y);
  const direction = d < 1e-8 ? Math.PI/2 : Math.atan2(target.y,target.x);
  const reach = Math.max(Math.abs(l1-l2), Math.min(l1+l2,d));
  const bend = Math.acos(Math.max(-1,Math.min(1,(reach*reach-l1*l1-l2*l2)/(2*l1*l2))));
  if(bend < 1e-8) return { shoulder: direction-Math.PI/2, elbow:0, elbowY:l1*Math.sin(direction) };
  const candidates = [bend,-bend].map(elbow => {
    const angle = direction-Math.atan2(l2*Math.sin(elbow),l1+l2*Math.cos(elbow));
    const rotation=angle-Math.PI/2;
    return {shoulder: Math.atan2(Math.sin(rotation),Math.cos(rotation)), elbow, elbowY: l1*Math.sin(angle)};
  });
  return candidates[0].elbowY > candidates[1].elbowY ? candidates[0] : candidates[1];
}
