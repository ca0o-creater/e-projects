import assert from 'node:assert/strict';
import {test} from 'node:test';
import {prologueAt, houyiWalkAt, prologueBlackout, prologueFadeIn} from '../src/scenes/prologue-timeline.ts';
import {prologueConfig as c} from '../src/config/prologue.config.ts';

const s = c.subtitle;

test('序章旁白总时长落在 8–10 秒，两段旁白依次出现',()=>{
  assert.ok(c.duration >= 8 && c.duration <= 10, `duration=${c.duration}`);
  assert.equal(c.lines.length, 2);
  const first = s.in + s.hold / 2;
  assert.equal(prologueAt(first).index, 0);
  assert.equal(prologueAt(first).text, c.lines[0]);
  assert.equal(prologueAt(first).alpha, 1);
  const second = c.step + s.in + s.hold / 2;
  assert.equal(prologueAt(second).index, 1);
  assert.equal(prologueAt(second).text, c.lines[1]);
  assert.equal(prologueAt(second).alpha, 1);
});

test('每句先淡入、再淡出，句间与句末不留残影',()=>{
  const lineEnd = s.in + s.hold + s.out;
  assert.equal(prologueAt(0).alpha, 0);
  assert.ok(prologueAt(s.in / 2).alpha > 0 && prologueAt(s.in / 2).alpha < 1);
  assert.equal(prologueAt(lineEnd).alpha, 0);
  assert.equal(prologueAt(c.step).alpha, 0);
  assert.equal(prologueAt(c.step + lineEnd).alpha, 0);
});

test('序章结束后旁白全部收起，状态交给第一幕',()=>{
  assert.equal(prologueAt(c.duration - 0.01).active, true);
  assert.equal(prologueAt(c.duration).active, false);
  assert.equal(prologueAt(c.duration).alpha, 0);
});

test('文字托底在序章末段随旁白一起淡出，切幕时不跳变',()=>{
  const fadeStart = c.duration - s.backdrop.fadeOut;
  assert.equal(prologueAt(0).backdropAlpha, 1);
  assert.equal(prologueAt(fadeStart - 0.01).backdropAlpha, 1);
  assert.ok(prologueAt(fadeStart + s.backdrop.fadeOut / 2).backdropAlpha < 0.7);
  assert.equal(prologueAt(c.duration).backdropAlpha, 0);
});

test('跳过按钮在配置时刻出现，暗场开始后不再显示',()=>{
  assert.equal(prologueAt(0).skipVisible, false);
  assert.equal(prologueAt(c.skip.appearAt - 0.01).skipVisible, false);
  assert.equal(prologueAt(c.skip.appearAt).skipVisible, true);
  assert.equal(prologueAt(c.duration - 0.01).skipVisible, true);
  assert.equal(prologueAt(c.duration).skipVisible, false);
});

test('负时间按 0 处理，时间越界不产生非法索引',()=>{
  const start = prologueAt(-3);
  assert.equal(start.index, 0);
  assert.equal(start.alpha, 0);
  assert.equal(start.text, c.lines[0]);
  const end = prologueAt(c.total + 5);
  assert.equal(end.active, false);
  assert.equal(end.alpha, 0);
  assert.equal(end.index, c.lines.length - 1);
});

test('旁白用深色文字与柔和托底，保证亮背景上的对比度',()=>{
  assert.equal(c.colors.text, '#3e2723');
  assert.ok(c.subtitle.backdrop.alpha > 0 && c.subtitle.backdrop.alpha < 0.3);
  assert.ok(c.subtitle.shadow.alpha > 0 && c.subtitle.shadow.blur > 0);
});

test('后羿从左下角走向右上方山门，缩到 30% 并变淡到 0.5',()=>{
  const w = c.houyiWalk;
  const start = houyiWalkAt(0);
  assert.equal(start.x, w.start.x);
  assert.equal(start.y, w.start.y);
  assert.equal(start.alpha, w.start.alpha);
  assert.ok(Math.abs(start.scale - w.start.height / w.crop.height) < 1e-9);
  const end = houyiWalkAt(c.duration);
  assert.equal(end.x, w.end.x);
  assert.equal(end.y, w.end.y);
  assert.equal(end.alpha, w.end.alpha);
  assert.ok(Math.abs(end.height - w.start.height * 0.3) < 1e-9);
  // 山门在后羿的右上方
  assert.ok(w.end.x > w.start.x);
  assert.ok(w.end.y < w.start.y);
  // 过程中位置、尺寸、透明度都朝终点单调变化
  for (let t = 0; t <= c.duration; t += 0.25) {
    const f = houyiWalkAt(t);
    assert.ok(f.x >= w.start.x - 1e-9 && f.x <= w.end.x + 1e-9);
    assert.ok(f.scale <= start.scale + 1e-9 && f.scale >= end.scale - 1e-9);
    assert.ok(f.alpha <= w.start.alpha + 1e-9 && f.alpha >= w.end.alpha - 1e-9);
  }
});

test('走路起伏幅度受配置限制，且旁白结束时归零',()=>{
  const w = c.houyiWalk;
  for (let t = 0; t <= c.duration; t += 0.05) {
    const f = houyiWalkAt(t);
    const straightY = w.start.y + (w.end.y - w.start.y) * f.progress;
    const limit = w.bob.amplitude * (f.height / w.start.height) + 1e-9;
    assert.ok(Math.abs(f.y - straightY) <= limit);
  }
  assert.ok(Math.abs(houyiWalkAt(c.duration).y - w.end.y) < 1e-9);
});

test('旁白结束后 0.5 秒暗场到位，再切到第一幕',()=>{
  assert.equal(prologueBlackout(0), 0);
  assert.equal(prologueBlackout(c.duration), 0);
  assert.ok(prologueBlackout(c.duration + c.transition.fadeToBlack / 2) > 0.4);
  assert.equal(prologueBlackout(c.total), 1);
  assert.equal(c.total, c.duration + c.transition.fadeToBlack);
  assert.equal(c.transition.fadeToBlack, 0.5);
  assert.equal(prologueAt(c.duration + 0.2).alpha, 0);
  assert.equal(prologueAt(c.duration + 0.2).skipVisible, false);
});

test('暗场后切到第一幕，再 0.5 秒亮起',()=>{
  assert.equal(prologueFadeIn(0), 1);
  const middle = prologueFadeIn(c.transition.fadeFromBlack / 2);
  assert.ok(middle > 0.4 && middle < 0.6);
  assert.equal(prologueFadeIn(c.transition.fadeFromBlack), 0);
  assert.equal(prologueFadeIn(10), 0);
});
