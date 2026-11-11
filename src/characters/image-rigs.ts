import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { rigConfig as cfg, armLengths } from '../config/rig.config.ts';

type Part = { pivotOffset: {x:number;y:number}; baseRotation:number; polygon: readonly number[] };
function art(texture:Texture, part:Part, scale:number, tint?:string, holes:readonly (readonly number[])[]=[]): Container {
  const node = new Container();
  node.rotation = part.baseRotation;
  node.scale.set(scale);
  const sprite = new Sprite(texture);
  sprite.position.set(-part.pivotOffset.x,-part.pivotOffset.y);
  if(tint) sprite.tint = tint;
  const mask = new Graphics().poly([...part.polygon]).fill('white');
  for(const hole of holes) mask.poly([...hole]).cut();
  mask.position.copyFrom(sprite.position);
  node.addChild(sprite,mask); sprite.mask = mask;
  return node;
}
export async function loadRigAssets(): Promise<void> {
  for(const c of [cfg.houyi,cfg.queen]) {
    const texture = await Assets.load<Texture>(c.url);
    if(texture.width !== c.textureSize.width || texture.height !== c.textureSize.height) throw new Error(`人物纹理尺寸不匹配：${c.url}`);
  }
}
export function createImageHouyi(tint?:string, suppliedTexture?:Texture) {
  const c=cfg.houyi, texture=suppliedTexture ?? Assets.get<Texture>(c.url);
  const root=new Container({label:'HouyiRig'}), torso=new Container({label:'torso'});
  const shoulderNode=new Container({label:'shoulderNode'}), elbowNode=new Container({label:'elbowNode'});
  const bow=new Graphics().moveTo(-25,-350).quadraticCurveTo(-155,-240,-25,-130).stroke({color:tint ?? '#4b2918',width:5})
    .moveTo(-25,-350).lineTo(-25,-130).stroke({color:tint ?? '#4b2918',width:1.5});
  torso.addChild(bow,art(texture,c.body,c.scale,tint,c.bodyHoles)); root.addChild(torso);
  shoulderNode.position.set((c.shoulder.x-c.origin.x)*c.scale,(c.shoulder.y-c.origin.y)*c.scale);
  const upperArm=new Container({label:'upperArm'}), forearm=art(texture,c.forearm,c.scale,tint);
  upperArm.addChild(art(texture,c.upperArm,c.scale,tint));
  // 美术校正容器与关节链分开，避免 baseRotation/纹理缩放累积到下一级骨骼。
  shoulderNode.addChild(upperArm); upperArm.addChild(elbowNode); elbowNode.y=armLengths.upper;
  elbowNode.addChild(forearm); torso.addChild(shoulderNode);
  const handNode=new Container({label:'handNode'}); handNode.y=armLengths.lower; elbowNode.addChild(handNode);
  return {root,torso,upperArm:shoulderNode,forearm:elbowNode,shoulderNode,elbowNode,handNode};
}
export function createImageQueen(tint?:string) {
  const c=cfg.queen, root=new Container({label:'QueenRig'});
  root.addChild(art(Assets.get<Texture>(c.url),c.body,c.scale,tint,c.bodyHoles));
  const arm=new Container({label:'固定手部挂点'});
  arm.position.set((c.handOffset.x-c.origin.x)*c.scale,(c.handOffset.y-c.origin.y)*c.scale);
  root.addChild(arm);
  return {root,arm};
}
