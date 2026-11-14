import assert from 'node:assert/strict';
import {test} from 'node:test';
import {actTwoEntranceAt,houyiDepartureAt} from '../src/scenes/act-two-entrance.ts';
import {actTwoConfig as c} from '../src/config/act-two.ts';
test('后羿从中央向左完整离场后才允许逢蒙登场',()=>{
  const end=c.intro.departureStart+c.intro.departureDuration;
  assert.ok(c.intro.approachStart>end);
  assert.equal(houyiDepartureAt(c.intro.departureStart,260).x,c.departingHouyi.startX);
  for(const extent of [150,260,400]) {
    const exit=houyiDepartureAt(end,extent);
    assert.ok(exit.x+extent<0);assert.equal(exit.visible,false);
    assert.equal(actTwoEntranceAt(end).progress,0);
    const middle=houyiDepartureAt(c.intro.departureStart+c.intro.departureDuration/2,extent);
    assert.ok(middle.x<c.departingHouyi.startX && middle.x>exit.x);
  }
});
test('逢蒙从屏外逼近；抖动后仍与整个手腕操作区保持200px间隔',()=>{
  assert.ok(actTwoEntranceAt(c.intro.approachStart).x>=1920);
  for(let t=0;t<40;t+=.01) {
    const pose=actTwoEntranceAt(t);
    assert.ok(pose.x-pose.operationRight>=c.pengMeng.safeGap-1e-8);
  }
});
test('逼近结束后先展示题字，再解锁；调整时间配置会自动顺延',()=>{
  const arrival=c.intro.approachStart+c.intro.approachDuration;
  assert.equal(actTwoEntranceAt(arrival-.01).warningAlpha,0);
  assert.ok(actTwoEntranceAt(arrival+.5).warningAlpha>0);
  assert.equal(actTwoEntranceAt(c.intro.duration-.001).unlocked,false);
  assert.equal(actTwoEntranceAt(c.intro.duration).unlocked,true);
  assert.equal(actTwoEntranceAt(c.intro.duration).warningAlpha,0);
});
test('停稳后的抖动幅度不超过1.5px，每秒2.5周期',()=>{
  const t=c.intro.duration+.25,a=actTwoEntranceAt(t),b=actTwoEntranceAt(t+1/c.pengMeng.jitterHz);
  assert.ok(Math.abs(a.x-b.x)<1e-8);
  assert.ok(Math.abs(a.x-a.endX)<=1.5);
});
