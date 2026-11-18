import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Texture,Container} from 'pixi.js';
import {createChangeRig} from '../src/characters/change.ts';
import {SwallowController} from '../src/interaction/swallow.ts';
import {scene2Config as c} from '../src/config/scene2.config.ts';
import {changeRigConfig} from '../src/config/change-rig.ts';
test('真实手掌挂点与拖拽弧线在全部抬臂进度精确重合，父层升空不改变局部对齐',()=>{
 const parent=new Container(),rig=createChangeRig(Texture.EMPTY),state=new SwallowController(()=>{});
 rig.root.position.set(c.changE.x,c.changE.y);
 rig.root.scale.set(c.changE.flipX?-c.changE.scale:c.changE.scale,c.changE.scale);
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

test('左向镜像后上拉跨越角度分界仍连续，最终掌心到达左侧嘴边',()=>{
 const state=new SwallowController(()=>{});state.prepare();
 state.input({type:'GRAB',point:state.point});
 let previousY=state.point.y;
 for(let i=0;i<=100;i++) {
  const point=state.pointAt(i/100);
  assert.ok(point.x<c.arm.center.x);
  assert.ok(point.y<=previousY+1e-8);previousY=point.y;
  state.input({type:'MOVE',point});
  assert.ok(Math.abs(state.progress-i/100)<1e-8);
 }
 // 原图侧面嘴唇约在 (685, 566)，转成镜像后的舞台坐标。
 const mouth={x:c.changE.x-(685-changeRigConfig.origin.x)*c.changE.scale,
   y:c.changE.y+(566-changeRigConfig.origin.y)*c.changE.scale};
 assert.ok(Math.hypot(state.point.x-mouth.x,state.point.y-mouth.y)<12);
 state.update(.4);assert.equal(state.state,'armed');
 state.input({type:'RELEASE'});assert.equal(state.state,'swallowing');
});
