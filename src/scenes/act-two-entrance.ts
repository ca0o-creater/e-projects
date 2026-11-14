import {actTwoConfig as c} from '../config/act-two.ts';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function actTwoEntranceAt(time:number) {
  const t=Math.max(0,time),i=c.intro,p=c.pengMeng;
  const progress=clamp((t-i.approachStart)/i.approachDuration);
  const tween=progress*progress*(3-2*progress);
  // 最右侧光圈边界 + 安全距离；把抖动振幅也计入，最靠近时仍留足200px。
  const operationRight=c.arm.center.x+c.arm.radius+c.arm.controlRadius+7;
  const endX=operationRight+p.safeGap+p.jitterAmplitude;
  const jitter=Math.sin(Math.max(0,t-i.approachStart)*Math.PI*2*p.jitterHz)*p.jitterAmplitude*clamp(progress*8);
  const arrivedAt=i.approachStart+i.approachDuration;
  return {x:p.startX+(endX-p.startX)*tween+jitter,progress,operationRight,endX,
    warningAlpha:t<arrivedAt || t>=i.duration?0:clamp((t-arrivedAt)/0.3)*(1-clamp((t-arrivedAt-i.warningHold)/i.warningFade)),
    unlocked:t>=i.duration};
}
