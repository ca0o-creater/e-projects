import { charactersConfig as actors } from '../config/characters.ts';
import { rigConfig, armLengths } from '../config/rig.config.ts';
import { solveTwoBone } from './ik.ts';

function handTarget(progress:number) {
  const {shoulder,elbow}=rigConfig.houyi.rest;
  const rest={x:-Math.sin(shoulder)*armLengths.upper-Math.sin(shoulder+elbow)*armLengths.lower,
    y:Math.cos(shoulder)*armLengths.upper+Math.cos(shoulder+elbow)*armLengths.lower};
  const end=rigConfig.houyi.receiveTarget,p=Math.max(0,Math.min(1,progress));
  return {x:rest.x+(end.x-rest.x)*p,y:rest.y+(end.y-rest.y)*p};
}

// 用于姿态预览和验证；运行时拖动直接解算药瓶坐标，不再把进度映射成角度。
export function receivingPose(progress:number) {
  return solveTwoBone(handTarget(progress),armLengths.upper,armLengths.lower)!;
}

export function receivingHand(progress:number) {
  const c=actors.houyi,target=handTarget(progress);
  return {x:c.x+(c.shoulder.x+target.x)*c.scale,
    y:c.y+(c.shoulder.y+target.y)*c.scale-actors.bottle.radius};
}
