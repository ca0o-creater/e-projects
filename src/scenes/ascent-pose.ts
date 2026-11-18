import {scene3Config as c} from '../config/scene3.config.ts';
import {changeRigConfig as rig} from '../config/change-rig.ts';
// 渲染与输入共用腰部坐标；人物放大时仍贴住用户抓住的主杆。
export function ascentPoseAt(progress:number) {
 const p=Math.max(0,Math.min(1,progress)),a=c.character;
 const scale=a.startScale+(a.endScale-a.startScale)*p;
 const y=a.startY+(a.endY-a.startY)*p;
 return {scale,x:a.x-(a.waist.x-rig.origin.x)*scale,y,
   point:{x:a.x,y:y+(a.waist.y-rig.origin.y)*scale}};
}
export const ascentDragDistance=ascentPoseAt(0).point.y-ascentPoseAt(1).point.y;
