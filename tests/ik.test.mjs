import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveTwoBone, solveArmIK, dampAngle } from '../src/characters/ik.ts';
import { rigConfig, armLengths } from '../src/config/rig.config.ts';
import { HandoffCurve } from '../src/interaction/curve.ts';
import { handoffConfig } from '../src/config/handoff.ts';
import { receivingHand } from '../src/characters/poses.ts';
import { charactersConfig as actors } from '../src/config/characters.ts';
test('二链杆在可达区精确到达目标，肘朝屏幕下方',()=>{
  const pose=solveTwoBone({x:120,y:0},80,70);
  const a=pose.shoulder+Math.PI/2,b=a+pose.elbow;
  assert.ok(Math.abs(80*Math.cos(a)+70*Math.cos(b)-120)<1e-8);
  assert.ok(Math.abs(80*Math.sin(a)+70*Math.sin(b))<1e-8);
  assert.ok(80*Math.sin(a)>0);
});
test('超出最大臂展伸直，近于内圈及零距离不产生NaN，拒绝无效输入',()=>{
  assert.equal(solveTwoBone({x:400,y:0},80,70).elbow,0);
  for(const x of [0,1,10,15,150]) {
    const p=solveTwoBone({x,y:0},80,70);
    assert.ok(Number.isFinite(p.shoulder)&&Number.isFinite(p.elbow));
  }
  assert.equal(solveTwoBone({x:NaN,y:0},80,70),null);
});

test('实际接药路径在吸附前产生明显弯肘，最终目标可达',()=>{
  const curve=new HandoffCurve({x:1472,y:230},...handoffConfig.controlPoints,receivingHand(1));
  const c=actors.houyi;
  for(const progress of [0.96,1]) {
    const point=curve.at(progress);
    const pose=solveArmIK(c.shoulder,{x:(point.x-c.x)/c.scale,y:(point.y+actors.bottle.radius-c.y)/c.scale},armLengths.upper,armLengths.lower);
    assert.ok(Math.abs(pose.elbow)>0.7,`进度 ${progress} 必须弯肘`);
  }
});

test('缓动没有瞬移，在不同帧率下收敛一致，角度跨界走短路径',()=>{
  assert.ok(dampAngle(0,-1,1/60,rigConfig.houyi.followSeconds)>-0.2);
  const run=n=>{let angle=0;for(let i=0;i<n;i++) angle=dampAngle(angle,-1,1/n,0.14);return angle;};
  assert.ok(Math.abs(run(30)-run(120))<1e-10);
  assert.ok(dampAngle(Math.PI-0.01,-Math.PI+0.01,1/60,0.14)>Math.PI-0.01);
});
