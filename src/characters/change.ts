import {Assets,Container,Graphics,Sprite,Texture} from 'pixi.js';
import {changeRigConfig as c,changeArm} from '../config/change-rig.ts';

export function createChangeRig(texture:Texture=Assets.get<Texture>(c.url)) {
  const root=new Container({label:'嫦娥 · 原图骨架'});
  root.position.set(c.position.x,c.position.y);root.scale.set(c.scale);
  const piece=(polygon:readonly number[],pivot:{x:number;y:number},holes:readonly (readonly number[])[]=[])=>{
    const node=new Container(),sprite=new Sprite(texture),mask=new Graphics().poly([...polygon]).fill('white');
    for(const hole of holes)mask.poly([...hole]).cut();
    sprite.position.set(-pivot.x,-pivot.y);mask.position.copyFrom(sprite.position);
    node.addChild(sprite,mask);sprite.mask=mask;return node;
  };
  for(const ribbon of c.ribbons)root.addChild(piece(ribbon,c.origin));
  root.addChild(piece(c.body,c.origin));
  const head=piece(c.head,c.neck,c.headHoles);head.position.set(c.neck.x-c.origin.x,c.neck.y-c.origin.y);root.addChild(head);
  const elbowNode=new Container({label:'嫦娥肘部铰链'});
  elbowNode.position.set(c.elbow.x-c.origin.x,c.elbow.y-c.origin.y);
  elbowNode.addChild(piece(c.forearm,c.elbow));
  const palmNode=new Container({label:'手掌 / 光圈 / 药瓶共同挂点'});
  palmNode.position.set(c.palm.x-c.elbow.x,c.palm.y-c.elbow.y);elbowNode.addChild(palmNode);
  elbowNode.addChild(new Graphics().circle(0,0,12).fill('#71451f').circle(0,0,7).fill('#cf9d4e'));
  root.addChild(elbowNode);
  const pose=(progress:number)=>{elbowNode.rotation=changeArm.startAngle+(changeArm.endAngle-changeArm.startAngle)*progress-changeArm.sourceAngle;};
  pose(0);return {root,head,elbowNode,palmNode,pose};
}
