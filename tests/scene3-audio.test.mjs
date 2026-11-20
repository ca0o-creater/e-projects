import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Scene3AudioManager, scene3AudioTracks } from '../src/audio/scene3-audio-manager.ts';
import { AscentController } from '../src/interaction/ascent.ts';
import { ActThreeScene } from '../src/scenes/act-three.ts';
import { ascentDragDistance } from '../src/scenes/ascent-pose.ts';
import { scene3Config as c } from '../src/config/scene3.config.ts';
import { SceneLifetime } from '../src/scenes/scene-lifetime.ts';
import { HoldButtonAdapter } from '../src/input/hold-button.ts';
import { EndingFilm } from '../src/ending-film.ts';

class FakeAudio extends EventTarget {
  static instances = [];
  paused = true; currentTime = 0; volume = 1; loop = false; plays = 0; loads = 0; error = null;
  listeners = new Map();
  constructor(src) { super(); this.src = src; FakeAudio.instances.push(this); }
  addEventListener(type, fn) {
    super.addEventListener(type, fn);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) { super.removeEventListener(type, fn); this.listeners.get(type)?.delete(fn); }
  play() { this.paused = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() { this.loads++; }
  removeAttribute() { this.src = ''; }
  end() { this.paused = true; this.dispatchEvent(new Event('ended')); }
}
globalThis.Audio = FakeAudio;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function setup(t, { skipIntro = false, staticPreview = false } = {}) {
  FakeAudio.instances = [];
  const manager = new Scene3AudioManager(); manager.preload();
  const audio = Object.fromEntries(Object.entries(scene3AudioTracks).map(([key, track]) =>
    [key, FakeAudio.instances.find(a => a.src === track.url)]));
  const s = new AscentController(() => {});
  if (skipIntro) s.prepare();
  manager.start(s.snapshot, { staticPreview });
  const life = new SceneLifetime();
  life.add(() => s.dispose()); life.add(() => manager.dispose());
  life.add(s.subscribeState((...args) => manager.onState(...args)));
  t.after(() => life.dispose());
  return { manager, s, audio, life };
}
function grab(s) { s.input({ type: 'GRAB', point: s.point }); }
function move(s, progress) {
  s.input({ type: 'MOVE', point: { x: s.targetCenter.x, y: s.targetCenter.y + ascentDragDistance * (1 - progress) } });
}
function release(s, cancelled = false) { s.input({ type: 'RELEASE', cancelled }); }
function ending(s) { grab(s); move(s, 1); s.update(.4); release(s); }

test('六条精确路径、循环设置、预载不播放；没有额外 intro 或视频音轨', t => {
  const f = setup(t);
  assert.deepEqual(Object.values(f.audio).map(a => a.src), [
    '/audio/scene3-moon-sky-loop.wav', '/audio/scene3-grab-rod.wav', '/audio/scene3-ascent-loop.wav',
    '/audio/scene3-target-charge.wav', '/audio/scene3-ascent-pause.wav', '/audio/scene3-moon-entry.wav',
  ]);
  for (const [key, a] of Object.entries(f.audio)) {
    assert.equal(a.loop, ['sky', 'ascent'].includes(key)); assert.equal(a.preload, 'auto');
    assert.equal(a.loads, 1); assert.equal(a.plays, 0);
  }
});

test('真实第三幕时间轴2.5秒后启动环境；skipIntro直接播放；静帧任何通知均静音', t => {
  const f = setup(t);
  const scene = { elapsed: 0, ascent: f.s, draw() {} };
  ActThreeScene.prototype.seek.call(scene, 2.499);
  assert.equal(f.audio.sky.plays, 0);
  ActThreeScene.prototype.seek.call(scene, 2.5);
  assert.equal(f.s.state, 'ready'); assert.equal(f.audio.sky.plays, 1);
  f.s.prepare(); assert.equal(f.audio.sky.plays, 1);
  const skip = setup(t, { skipIntro: true }); assert.equal(skip.audio.sky.plays, 1);
  const still = setup(t, { skipIntro: true, staticPreview: true });
  ending(still.s); still.manager.pause(); still.manager.resume();
  assert.ok(Object.values(still.audio).every(a => a.plays === 0));
});

test('抓取播grab和升空；MOVE不重播；环境避让不重置进度', t => {
  const f = setup(t, { skipIntro: true }); f.audio.sky.currentTime = 9;
  grab(f.s); for (const p of [.1, .2, .3, .4]) move(f.s, p);
  assert.equal(f.audio.grab.plays, 1); assert.equal(f.audio.ascent.plays, 1);
  assert.equal(f.audio.sky.volume, .5); assert.equal(f.audio.sky.currentTime, 9); assert.equal(f.audio.sky.plays, 1);
});

test('进圈充能一次，圈内抖动/armed不重播；离圈清零charge并恢复升空', t => {
  const f = setup(t, { skipIntro: true }); grab(f.s); move(f.s, 1);
  assert.equal(f.audio.ascent.paused, true); assert.equal(f.audio.ascent.currentTime, 0);
  for (const dx of [10, -10, 20, -20]) {
    f.s.input({ type: 'MOVE', point: { x: f.s.targetCenter.x + dx, y: f.s.targetCenter.y } }); f.s.update(.1);
  }
  assert.equal(f.s.state, 'armed'); assert.equal(f.audio.charge.plays, 1);
  f.audio.charge.currentTime = .2; move(f.s, .2);
  assert.equal(f.audio.charge.paused, true); assert.equal(f.audio.charge.currentTime, 0);
  assert.equal(f.audio.ascent.plays, 2); assert.equal(f.audio.grab.plays, 1);
  move(f.s, 1); assert.equal(f.audio.charge.plays, 2);
  f.s.update(.2); move(f.s, .2); assert.equal(f.audio.ascent.plays, 3);
});

test('正常中途松手悬停一次且保留高度，再抓取可继续；充能不足松手同样悬停', t => {
  const f = setup(t, { skipIntro: true }); grab(f.s); move(f.s, .4); release(f.s); release(f.s);
  assert.equal(f.audio.pause.plays, 1); assert.ok(Math.abs(f.s.progress - .4) < 1e-9);
  f.s.update(10); assert.ok(Math.abs(f.s.progress - .4) < 1e-9);
  assert.equal(f.audio.sky.volume, 1); assert.equal(f.audio.ascent.paused, true);
  grab(f.s); move(f.s, 1); f.s.update(.2); release(f.s);
  assert.equal(f.audio.pause.plays, 2); assert.equal(f.audio.grab.plays, 2);
  assert.equal(f.audio.entry.plays, 0); assert.equal(f.audio.charge.paused, true);
});

test('辅助启动不播grab，普通progress更新不重启；中途正常松开只播一次悬停', t => {
  const f = setup(t, { skipIntro: true });
  assert.equal(f.s.startAssist(), true); assert.equal(f.s.startAssist(), false);
  for (let i = 0; i < 10; i++) f.s.update(.1);
  assert.equal(f.audio.grab.plays, 0); assert.equal(f.audio.ascent.plays, 1);
  const progress = f.s.progress;
  f.s.cancel(false); f.s.cancel(false); f.s.update(20);
  assert.equal(f.audio.pause.plays, 1); assert.equal(f.s.progress, progress);
  assert.equal(f.audio.ascent.currentTime, 0); assert.equal(f.audio.sky.volume, 1);
});

test('辅助到顶开始charging，停稳后自动ending；不得产生假悬停', t => {
  const f = setup(t, { skipIntro: true }); f.s.progress = .99; f.s.startAssist();
  f.s.update((1 - .99) / c.control.assistSpeed);
  assert.equal(f.s.snapshot.charging, true); assert.equal(f.audio.charge.plays, 1);
  assert.equal(f.audio.ascent.paused, true);
  f.s.update(.399); assert.equal(f.s.state, 'ready');
  f.s.update(.001); assert.equal(f.s.state, 'ending');
  assert.equal(f.audio.entry.plays, 1); assert.equal(f.audio.pause.plays, 0);
});

test('有效手动松手仅播一次入月；3.2秒complete停环境但不截断自然尾音', t => {
  const f = setup(t, { skipIntro: true }); ending(f.s); release(f.s);
  assert.equal(c.ending.flightSeconds, 2.4); assert.equal(c.ending.pulseSeconds, .8);
  assert.ok(Math.abs(c.ending.duration - 3.2) < 1e-9);
  assert.equal(f.audio.entry.plays, 1); assert.equal(f.audio.sky.volume, .25);
  for (const k of ['grab', 'ascent', 'charge', 'pause']) assert.equal(f.audio[k].paused, true);
  f.s.update(c.ending.duration);
  assert.equal(f.s.state, 'complete'); assert.equal(f.audio.sky.paused, true); assert.equal(f.audio.sky.currentTime, 0);
  assert.equal(f.audio.entry.plays, 1); assert.equal(f.audio.entry.paused, false);
  f.audio.entry.end(); assert.equal(f.audio.entry.paused, true);
});

test('后台先暂停再取消，恢复不复活短声音；forced RELEASE/越界取消也不播悬停', async t => {
  const f = setup(t, { skipIntro: true }); await flush(); grab(f.s); move(f.s, .4);
  f.manager.pause(); release(f.s, true); f.manager.resume();
  assert.equal(f.audio.pause.plays, 0); assert.equal(f.audio.ascent.paused, true);
  grab(f.s); release(f.s, true); assert.equal(f.audio.pause.plays, 0);
  grab(f.s); f.s.input({ type: 'MOVE', point: { x: NaN, y: 0 } }); assert.equal(f.audio.pause.plays, 0);
  f.s.startAssist(); f.manager.pause(); f.s.cancel(); f.manager.resume();
  assert.equal(f.audio.pause.plays, 0); assert.equal(f.audio.ascent.paused, true);
});

test('环境及入月剧情暂停恢复保留位置，WebAudio路由仅建立一次并在销毁时释放', async t => {
  const original = globalThis.AudioContext; const contexts = [];
  class Context {
    state = 'suspended'; destination = {}; nodes = []; sources = [];
    constructor() { contexts.push(this); }
    node() { const n = { connect() {}, disconnect() { this.disconnected = true; } }; this.nodes.push(n); return n; }
    createMediaElementSource(a) { assert.ok(!this.sources.includes(a)); this.sources.push(a); return this.node(); }
    createGain() { return Object.assign(this.node(), { gain: { value: 1 } }); }
    createDynamicsCompressor() { return Object.assign(this.node(), Object.fromEntries(
      ['threshold', 'ratio', 'knee', 'attack', 'release'].map(k => [k, { value: 0 }]))); }
    async resume() { this.state = 'running'; } async close() { this.state = 'closed'; }
  }
  globalThis.AudioContext = Context;
  t.after(() => { if (original) globalThis.AudioContext = original; else delete globalThis.AudioContext; });
  const f = setup(t, { skipIntro: true }); ending(f.s); await flush();
  f.audio.sky.currentTime = 12; f.audio.entry.currentTime = 1.7;
  const count = contexts[0].sources.length;
  f.manager.pause(); f.manager.resume(); await flush();
  assert.equal(f.audio.entry.currentTime, 1.7); assert.equal(f.audio.sky.currentTime, 12);
  assert.equal(f.audio.entry.paused, false); assert.equal(contexts[0].sources.length, count);
  assert.ok(contexts[0].nodes.some(n => n.gain?.value === 10 ** (16 / 20)));
  f.life.dispose(); assert.equal(contexts[0].state, 'closed'); assert.ok(contexts[0].nodes.every(n => n.disconnected));
});

test('销毁归零移除监听；旧ended/error与迟到play拒绝不影响新请求', async t => {
  const f = setup(t, { skipIntro: true }); let reject;
  f.audio.ascent.play = () => new Promise((_, fail) => { reject = fail; });
  grab(f.s); move(f.s, 1); f.audio.ascent.play = FakeAudio.prototype.play; move(f.s, .2);
  reject(new Error('old request')); await flush(); assert.equal(f.audio.ascent.paused, false);
  const callbacks = Object.values(f.audio).flatMap(a => [...a.listeners.values()].flatMap(set => [...set]));
  for (const a of Object.values(f.audio)) a.currentTime = .1;
  f.life.dispose(); f.manager.dispose();
  for (const fn of callbacks) fn();
  f.manager.resume(); f.manager.retryBlocked();
  for (const a of Object.values(f.audio)) {
    a.end(); a.dispatchEvent(new Event('error'));
    assert.equal(a.paused, true); assert.equal(a.currentTime, 0); assert.equal(a.src, '');
    assert.ok([...a.listeners.values()].every(set => set.size === 0));
  }
});

test('环境被拦截可重试；已取消的升空循环和短反馈不得迟到重播', async t => {
  const f = setup(t);
  f.audio.sky.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
  f.s.prepare(); await flush(); f.audio.sky.play = FakeAudio.prototype.play;
  f.manager.retryBlocked(); await flush(); assert.equal(f.audio.sky.plays, 1);
  f.audio.ascent.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
  grab(f.s); await flush(); release(f.s);
  f.audio.ascent.play = FakeAudio.prototype.play; f.manager.retryBlocked();
  assert.equal(f.audio.ascent.plays, 0);
});

test('辅助按钮正常pointerup与pointercancel/blur/dispose具有不同通知原因', t => {
  const old = globalThis.window; globalThis.window = new EventTarget();
  const f = setup(t, { skipIntro: true });
  class Button extends EventTarget {
    captured = false; setPointerCapture() { this.captured = true; } hasPointerCapture() { return this.captured; }
    releasePointerCapture() { this.captured = false; this.dispatchEvent(new Event('lostpointercapture')); }
  }
  const b = new Button();
  const adapter = new HoldButtonAdapter(b, () => f.s.startAssist(), cancelled => f.s.cancel(cancelled));
  t.after(() => { adapter.dispose(); globalThis.window = old; });
  const down = () => b.dispatchEvent(Object.assign(new Event('pointerdown', { cancelable: true }), { button: 0, isPrimary: true, pointerId: 1 }));
  down(); f.s.update(.2); b.dispatchEvent(new Event('pointerup'));
  assert.equal(f.audio.pause.plays, 1);
  for (const end of [() => b.dispatchEvent(new Event('pointercancel')), () => window.dispatchEvent(new Event('blur')), () => adapter.dispose()]) {
    down(); f.s.update(.2); end(); assert.equal(f.audio.pause.plays, 1);
  }
});

test('通知仅在四项状态变化时发出，可注销；dispose后不再通知', () => {
  const s = new AscentController(() => {}), seen = [];
  const off = s.subscribeState((next, prev, reason) => seen.push({ next, prev, reason }));
  s.prepare(); grab(s); const n = seen.length;
  move(s, .1); move(s, .2); s.update(.1); assert.equal(seen.length, n);
  move(s, 1); assert.equal(seen.at(-1).next.charging, true); assert.equal(seen.at(-1).next.inTarget, true);
  s.update(.4); assert.equal(seen.at(-1).next.state, 'armed');
  s.cancel(); assert.equal(seen.at(-1).reason, 'cancel');
  s.progress = .99; s.startAssist(); assert.equal(seen.at(-1).next.assisting, true);
  s.update(.08); assert.equal(seen.at(-1).next.charging, true);
  off(); const before = seen.length; s.cancel(); s.dispose(); assert.equal(seen.length, before);
  const s2 = new AscentController(() => {}); let count = 0; s2.subscribeState(() => count++);
  s2.dispose(); s2.dispose(); s2.prepare(); s2.cancel(); s2.update(2); grab(s2);
  assert.equal(count, 1);
});

test('视频首帧出现前停止第三幕全部音频，视频仍静音且不等待entry ended', t => {
  const old = globalThis.document; t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = setup(t, { skipIntro: true }); ending(f.s); f.s.update(c.ending.duration);
  let revealed = false, video;
  class Element extends EventTarget {
    children = []; style = {}; dataset = {};
    classList = { add: name => {
      if (name === 'is-visible') {
        assert.ok(Object.values(f.audio).every(a => a.paused && a.currentTime === 0)); revealed = true;
      }
    }, remove() {} };
    append(...items) { this.children.push(...items); } remove() {} setAttribute() {} removeAttribute() {}
    load() {} pause() {} play() { return Promise.resolve(); }
    requestVideoFrameCallback(fn) { this.frame = fn; return 1; } cancelVideoFrameCallback() {}
  }
  globalThis.document = { body: new Element(), createElement(tag) { const e = new Element(); if (tag === 'video') video = e; return e; } };
  const film = new EndingFilm(() => f.manager.stopAllAudio(), () => {}, () => f.manager.stopAllAudio());
  t.after(() => { film.dispose(); globalThis.document = old; });
  film.start(); assert.equal(film.phase, 'loading'); assert.equal(f.audio.entry.paused, false);
  video.dispatchEvent(new Event('playing')); video.frame();
  assert.equal(revealed, true); assert.equal(video.muted, true); assert.equal(video.defaultMuted, true);
  f.manager.retryBlocked(); f.manager.resume(); assert.equal(f.audio.entry.paused, true);
});
