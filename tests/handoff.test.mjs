import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HandoffController } from '../src/interaction/handoff.ts';
import { HandoffCurve, distance } from '../src/interaction/curve.ts';
import { handoffConfig as config } from '../src/config/handoff.ts';
import { receivingHand, receivingPose } from '../src/characters/poses.ts';
import { charactersConfig } from '../src/config/characters.ts';
import { createHouyiRig } from '../src/characters/puppets.ts';
import { createImageHouyi } from '../src/characters/image-rigs.ts';
import { Texture } from 'pixi.js';

const start = { x: 1380, y: 285 };
const curve = new HandoffCurve(start, ...config.controlPoints, receivingHand(1));
function fixture() {
  let successes = 0;
  const controller = new HandoffController(receivingHand, () => successes++);
  return { controller, successes: () => successes };
}
function ready(controller) {
  controller.prepare();
  controller.setPath(start);
  controller.update(config.offering.duration);
  assert.equal(controller.state, 'ready');
}
function drag(controller, progress) {
  controller.input({ type: 'GRAB', point: start });
  controller.input({ type: 'MOVE', point: curve.at(progress) });
}

test('剧情和赐药准备完成前不能拖动，空白处不能抓取', () => {
  const { controller: c } = fixture();
  c.input({ type: 'GRAB', point: start });
  assert.equal(c.state, 'intro');
  c.prepare();
  c.input({ type: 'GRAB', point: start });
  assert.equal(c.state, 'offering');
  c.setPath(start);
  c.update(config.offering.duration);
  c.input({ type: 'GRAB', point: { x: 900, y: 900 } });
  assert.equal(c.state, 'ready');
  assert.ok(c.canGrab(start));
});

test('路径使用弧长进度，离开路径的输入仍投影到路径，越界夹紧', () => {
  for (const p of [0, 0.1, 0.5, 0.9, 1]) assert.ok(Math.abs(curve.project(curve.at(p)) - p) < 0.001);
  assert.ok(distance(curve.at(-10), start) < 0.001);
  assert.ok(distance(curve.at(10), receivingHand(1)) < 0.001);
  const a = curve.at(0.5);
  const near = curve.at(curve.project({ x: a.x + 30, y: a.y + 60 }));
  assert.ok(distance(near, a) < 80);
});

test('拖动进度同步手臂，提前松开沿原路径返回，可以再次抓取', () => {
  const { controller: c, successes } = fixture();
  ready(c); drag(c, 0.5);
  assert.equal(c.state, 'dragging');
  assert.ok(Math.abs(c.armProgress - 0.5) < 0.001);
  c.input({ type: 'RELEASE' });
  assert.equal(c.state, 'returning');
  assert.equal(c.message, '请重新尝试');
  c.update(config.returnDuration / 2);
  assert.ok(c.progress > 0 && c.progress < 0.5);
  assert.ok(distance(c.point, curve.at(c.progress)) < 0.001);
  c.update(config.returnDuration);
  assert.equal(c.state, 'ready');
  assert.equal(c.progress, 0);
  assert.equal(c.armProgress, 0);
  c.input({ type: 'GRAB', point: start });
  assert.equal(c.state, 'dragging');
  assert.equal(successes(), 0);
});

test('100px容错区吸附，吸附后移动无效；松开才完成，成功仅一次', () => {
  const { controller: c, successes } = fixture();
  ready(c); drag(c, 0.94);
  assert.equal(c.state, 'snapped');
  assert.equal(c.message, '已接住，可以松手了');
  assert.equal(successes(), 0);
  c.update(config.snapDuration);
  assert.ok(distance(c.point, receivingHand(1)) < 0.001);
  c.input({ type: 'MOVE', point: start });
  assert.equal(c.progress, 1);
  c.input({ type: 'RELEASE' });
  assert.equal(c.state, 'completing');
  c.update(config.snapDuration + config.retractDuration + 0.01);
  assert.equal(c.state, 'complete');
  assert.equal(c.armProgress, 0);
  assert.equal(c.message, '凡间地点已解锁');
  for (let i = 0; i < 5; i++) { c.input({ type: 'RELEASE' }); c.assist(); c.update(10); }
  assert.equal(successes(), 1);
});

test('取消、失焦或退出全屏在吸附后也不能误判成功', () => {
  const { controller: c, successes } = fixture();
  ready(c); drag(c, 1);
  c.input({ type: 'RELEASE', cancelled: true });
  assert.equal(c.state, 'returning');
  c.update(5);
  assert.equal(c.state, 'ready');
  assert.equal(successes(), 0);
});

test('辅助完成覆盖等待、拖动、吸附、返回阶段，重复点击只成功一次', () => {
  for (const state of ['ready', 'dragging', 'snapped', 'returning']) {
    const { controller: c, successes } = fixture();
    ready(c);
    if (state !== 'ready') drag(c, state === 'snapped' ? 1 : 0.4);
    if (state === 'returning') c.input({ type: 'RELEASE' });
    assert.equal(c.state, state);
    c.assist(); c.assist();
    c.update(5);
    assert.equal(c.state, 'complete');
    assert.equal(successes(), 1);
  }
});

test('目标手部计算与实际 Pixi 骨架在所有姿势下吻合，药瓶底部落在掌心', () => {
  const rig = createImageHouyi(undefined, Texture.EMPTY);
  const c = charactersConfig.houyi;
  rig.root.position.set(c.x, c.y);
  rig.root.scale.set(c.scale);
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    const pose = receivingPose(p);
    rig.upperArm.rotation = pose.shoulder;
    rig.forearm.rotation = pose.elbow;
    const hand = rig.handNode.toGlobal({ x: 0, y: 0 });
    const target = receivingHand(p);
    assert.ok(distance(hand, { x: target.x, y: target.y + charactersConfig.bottle.radius }) < 0.001);
  }
  rig.root.destroy({ children: true });
});
