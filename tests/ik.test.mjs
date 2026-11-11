import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveTwoBone } from '../src/characters/ik.ts';
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
