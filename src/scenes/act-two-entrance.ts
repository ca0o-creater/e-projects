import {actTwoConfig as c} from '../config/act-two.ts';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function houyiDepartureAt(time:number,rightExtent:number) {
  const i=c.intro,p=c.departingHouyi;
  const finished=time>=i.departureStart+i.departureDuration;
  const progress=finished?1:clamp((time-i.departureStart)/i.departureDuration);
  const tween=progress*progress*(3-2*progress);
  const endX=Math.min(p.endX,-rightExtent-p.offstageMargin);
  return {x:p.startX+(endX-p.startX)*tween,progress,
    alpha:clamp((time-i.departureStart)/p.fadeInSeconds)*(1-tween),
    visible:time>=i.departureStart && !finished};
}
export function actTwoEntranceAt(time:number) {
  const t=Math.max(0,time),i=c.intro,p=c.pengMeng;
  const progress=clamp((t-i.approachStart)/i.approachDuration);
  const tween=progress*progress*(3-2*progress);
  // 镜像后的手指是人物最右端，终点在操作弧线左侧。
  const operationLeft=c.arm.center.x-c.arm.radius-c.arm.controlRadius-7;
  const endX=Math.min(p.endX,operationLeft-p.safeGap-p.jitterAmplitude);
  const jitter=Math.sin(Math.max(0,t-i.approachStart)*Math.PI*2*p.jitterHz)*p.jitterAmplitude*clamp(progress*8);
  const arrivedAt=i.approachStart+i.approachDuration;
  const walk=-Math.abs(Math.sin(progress*Math.PI*2*p.walkHz*i.approachDuration))*p.walkAmplitude*Math.sin(progress*Math.PI);
  return {x:p.startX+(endX-p.startX)*tween+jitter,y:p.y+walk,progress,operationLeft,endX,
    warningAlpha:t<arrivedAt || t>=i.duration?0:clamp((t-arrivedAt)/0.3)*(1-clamp((t-arrivedAt-i.warningHold)/i.warningFade)),
    unlocked:t>=i.duration};
}
