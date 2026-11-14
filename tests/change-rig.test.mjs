import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Texture,Container} from 'pixi.js';
import {createChangeRig} from '../src/characters/change.ts';
import {SwallowController} from '../src/interaction/swallow.ts';
test('真实手掌挂点与拖拽弧线在全部抬臂进度精确重合，父层升空不改变局部对齐',()=>{
 const parent=new Container(),rig=createChangeRig(Texture.EMPTY),state=new SwallowController(()=>{});
 parent.addChild(rig.root);
 for(const y of [0,-120,-220]) {
  parent.y=y;
  for(let i=0;i<=100;i++) {
   rig.pose(i/100);
   const actual=parent.toLocal(rig.palmNode.toGlobal({x:0,y:0})),expected=state.pointAt(i/100);
   assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<1e-6);
  }
 }
 parent.destroy({children:true});
});
