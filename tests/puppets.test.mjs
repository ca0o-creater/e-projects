import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHouyiRig } from '../src/characters/puppets.ts';
import { charactersConfig } from '../src/config/characters.ts';

test('后羿头、躯干、肩、肘独立，肘跟随肩的变换', () => {
  const rig = createHouyiRig('#241b18');
  assert.equal(rig.head.parent, rig.torso);
  assert.equal(rig.upperArm.parent, rig.torso);
  assert.equal(rig.forearm.parent, rig.upperArm);
  assert.equal(rig.upperArm.pivot.x, 0);
  assert.equal(rig.upperArm.pivot.y, 0);
  assert.equal(rig.forearm.pivot.x, 0);
  assert.equal(rig.forearm.pivot.y, 0);
  assert.equal(rig.forearm.y, charactersConfig.houyi.upperArm.length);
  // 旋转肩关节后，肘位置改变，肩位置仍固定。
  const shoulder = rig.upperArm.toGlobal({ x: 0, y: 0 });
  const elbowBefore = rig.forearm.toGlobal({ x: 0, y: 0 });
  rig.upperArm.rotation = -Math.PI / 2;
  const elbowAfter = rig.forearm.toGlobal({ x: 0, y: 0 });
  const shoulderAfter = rig.upperArm.toGlobal({ x: 0, y: 0 });
  assert.ok(Math.abs(shoulder.x - shoulderAfter.x) < 0.001);
  assert.ok(Math.abs(shoulder.y - shoulderAfter.y) < 0.001);
  assert.ok(Math.hypot(elbowAfter.x - elbowBefore.x, elbowAfter.y - elbowBefore.y) > 50);
  assert.ok(Math.abs(Math.hypot(elbowAfter.x - shoulder.x, elbowAfter.y - shoulder.y) - charactersConfig.houyi.upperArm.length) < 0.001);
  rig.root.destroy({ children: true });
});
