import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EndingAudioManager, endingAudioTracks } from '../src/audio/ending-audio-manager.ts';
import { scene3Config } from '../src/config/scene3.config.ts';
import { FakeAudio, flush } from './helpers/ending-media.mjs';

function setup(t) {
  const old = globalThis.Audio; globalThis.Audio = FakeAudio; FakeAudio.instances = [];
  const manager = new EndingAudioManager(); const [moon, cry, caption] = FakeAudio.instances;
  t.after(() => { manager.dispose(); globalThis.Audio = old; });
  return { manager, moon, cry, caption };
}

test('两条精确路径、非循环、预载静音；moon 1.2s 与 cry 4s 并行且仅启动一次', t => {
  const { manager, moon, cry } = setup(t); manager.preload();
  assert.deepEqual([moon.src, cry.src], ['/audio/ending-moon-response.wav', '/audio/ending-change-cry.wav']);
  for (const a of [moon, cry]) {
    assert.equal(a.loop, false); assert.equal(a.preload, 'auto'); assert.equal(a.loads, 1); assert.equal(a.plays, 0);
  }
  manager.start(); manager.start();
  for (const a of [moon, cry]) { assert.deepEqual(a.starts, [0]); assert.equal(a.playbackRate, 1); }
  moon.currentTime = 1.2; cry.currentTime = 1.2; moon.end();
  assert.equal(cry.paused, false); assert.equal(cry.currentTime, 1.2); assert.equal(cry.plays, 1);
  cry.currentTime = scene3Config.video.targetSeconds; assert.equal(cry.currentTime, 4); cry.end();
  manager.start(); manager.retryBlocked(); manager.resume();
  for (const a of [moon, cry]) {
    assert.equal(a.plays, 1); assert.ok([...a.listeners.values()].every(set => set.size === 0));
  }
});

test('任一音轨加载或播放失败不阻断另一条', async t => {
  const { manager, moon, cry } = setup(t); moon.error = { code: 4 }; manager.start();
  assert.equal(moon.plays, 0); assert.equal(cry.plays, 1); assert.equal(cry.paused, false);
  const other = new EndingAudioManager(); t.after(() => other.dispose());
  const [m, c] = FakeAudio.instances.slice(-3); c.play = () => Promise.reject(new Error('decode'));
  other.start(); await flush(); assert.equal(m.paused, false); assert.equal(c.paused, true);
});

test('暂停保存进度，恢复按显示时间校正；80ms 内保持连续，不重复 start', async t => {
  const { manager, moon, cry } = setup(t); manager.start(); await flush();
  moon.currentTime = .4; cry.currentTime = .38; manager.pause();
  assert.equal(moon.currentTime, .4); assert.equal(cry.currentTime, .38);
  manager.resume(.43); await flush(); manager.resume(.9);
  assert.deepEqual(moon.starts, [0, .4]); assert.deepEqual(cry.starts, [0, .38]);
  manager.pause(); manager.resume(.8);
  assert.equal(moon.currentTime, .8); assert.equal(cry.currentTime, .8);
  manager.start(); assert.equal(cry.plays, 3);
});

test('恢复超过1.2秒不复活月光响应，超过4秒不补播哭声', async t => {
  const { manager, moon, cry } = setup(t); manager.start(); await flush();
  moon.currentTime = .7; cry.currentTime = .7; manager.pause(); manager.resume(2);
  assert.equal(moon.paused, true); assert.equal(moon.currentTime, 0); assert.equal(moon.plays, 1);
  assert.deepEqual(cry.starts, [0, 2]);
  manager.pause(); manager.resume(4); manager.retryBlocked(4);
  assert.equal(cry.paused, true); assert.equal(cry.currentTime, 0); assert.equal(cry.plays, 2);
});

test('自动播放受限允许当前视频重试并对齐；停止后真实点击也不能补播', async t => {
  const { manager, moon, cry } = setup(t);
  for (const a of [moon, cry]) a.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
  manager.start(); await flush();
  for (const a of [moon, cry]) a.play = FakeAudio.prototype.play;
  manager.retryBlocked(1.5); await flush();
  assert.equal(moon.plays, 0); assert.deepEqual(cry.starts, [1.5]);
  manager.stopAllAudio(); manager.retryBlocked(2); manager.start(); manager.resume(2);
  assert.equal(cry.plays, 1); assert.equal(cry.currentTime, 0);
});

test('暂停期间不重试；旧 play 的迟到拒绝不干扰恢复后的请求', async t => {
  const { manager, moon, cry } = setup(t); let reject;
  cry.play = () => new Promise((_, fail) => { reject = fail; });
  manager.start(); manager.pause(); cry.play = FakeAudio.prototype.play;
  manager.retryBlocked(.5); assert.equal(cry.plays, 0);
  manager.resume(.5); reject(new Error('old request')); await flush();
  assert.equal(cry.paused, false); assert.equal(moon.paused, false); assert.deepEqual(cry.starts, [.5]);
});

test('dispose 幂等：停止、清零、释放 src 与监听；迟到回调及重演互不影响', t => {
  const { manager, moon, cry } = setup(t); manager.start();
  const late = [...moon.listeners.values(), ...cry.listeners.values()].flatMap(s => [...s]);
  moon.currentTime = .6; cry.currentTime = .6; manager.dispose(); manager.dispose();
  const replay = new EndingAudioManager(); t.after(() => replay.dispose()); replay.start();
  for (const callback of late) callback(); manager.start(); manager.resume(); manager.retryBlocked();
  for (const a of [moon, cry]) {
    assert.equal(a.paused, true); assert.equal(a.currentTime, 0); assert.equal(a.src, ''); assert.equal(a.plays, 1);
    assert.ok([...a.listeners.values()].every(s => s.size === 0));
  }
  assert.ok(FakeAudio.instances.slice(-3, -1).every(a => a.plays === 1 && !a.paused));
});

test('非破坏性增益、轻压缩；每元素只建一次路由，暂停恢复不重建，销毁断开', async t => {
  const old = globalThis.AudioContext; const nodes = [], contexts = [];
  const node = () => { const n = { connect() {}, disconnect() { this.disconnected = true; } }; nodes.push(n); return n; };
  class Context {
    state = 'running'; destination = {}; sources = []; gains = []; compressors = [];
    constructor() { contexts.push(this); }
    createMediaElementSource(a) { this.sources.push(a); return node(); }
    createGain() { const n = Object.assign(node(), { gain: { value: 1 } }); this.gains.push(n); return n; }
    createDynamicsCompressor() {
      const n = Object.assign(node(), Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(k => [k, { value: 0 }])));
      this.compressors.push(n); return n;
    }
    resume() { return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  globalThis.AudioContext = Context; t.after(() => { globalThis.AudioContext = old; });
  const { manager, moon } = setup(t); manager.start(); await flush(); manager.pause(); manager.resume(.3); await flush();
  assert.equal(contexts.length, 1); const ctx = contexts[0]; assert.equal(ctx.sources.length, 2);
  assert.deepEqual(ctx.gains.map(n => n.gain.value), [1, 10 ** (7 / 20)]); assert.equal(moon.volume, .6);
  assert.deepEqual(Object.fromEntries(Object.keys(endingAudioTracks.cry.compress).map(k => [k, ctx.compressors[0][k].value])), endingAudioTracks.cry.compress);
  manager.stopVideoAudio(); manager.playCaption(); await flush(); manager.pause(); manager.resume(); await flush();
  assert.equal(ctx.sources.length, 3); assert.equal(ctx.gains[2].gain.value, 10 ** (2.5 / 20));
  assert.equal(ctx.compressors.length, 1); // 旁白保留动态，不新增压缩器。
  manager.stopCaption(); assert.ok(nodes.slice(-2).every(n => n.disconnected));
  manager.dispose(); assert.ok(nodes.every(n => n.disconnected)); assert.equal(ctx.state, 'closed');
});

test('caption 精确路径、非循环、预载及视频播放不触发；视频停止后独立单次播放', t => {
  const { manager, moon, cry, caption } = setup(t); manager.preload();
  assert.equal(caption.src, '/audio/ending-caption-voice.wav'); assert.equal(caption.loop, false);
  assert.equal(caption.loads, 1); assert.equal(caption.plays, 0);
  manager.start(); assert.equal(caption.plays, 0); manager.stopVideoAudio();
  manager.playCaption(); manager.playCaption(); manager.start(); manager.stopVideoAudio();
  assert.deepEqual(caption.starts, [0]); assert.equal(caption.paused, false);
  for (const a of [moon, cry]) { assert.equal(a.plays, 1); assert.equal(a.paused, true); assert.equal(a.currentTime, 0); }
  caption.currentTime = scene3Config.video.captionVoiceSeconds; assert.equal(caption.currentTime, 3); caption.end();
  manager.playCaption(); manager.retryBlocked(); manager.pause(); manager.resume();
  assert.equal(caption.plays, 1); assert.equal(caption.currentTime, 0);
});

test('首帧前失败也能单独播放旁白；暂停恢复只续播旁白不复活视频声音', async t => {
  const { manager, moon, cry, caption } = setup(t); manager.pause(); manager.stopVideoAudio(); manager.resume();
  manager.playCaption(); await flush(); caption.currentTime = 1.1; manager.pause();
  assert.equal(caption.paused, true); assert.equal(caption.currentTime, 1.1);
  manager.resume(99); await flush(); manager.resume(); manager.playCaption();
  assert.deepEqual(caption.starts, [0, 1.1]); assert.equal(moon.plays, 0); assert.equal(cry.plays, 0);
});

test('stopAllAudio 清零全部三轨，stopCaption 永久撤销旁白并释放，不能由重试补播', t => {
  const { manager, moon, cry, caption } = setup(t); manager.start(); manager.playCaption();
  for (const a of [moon, cry, caption]) a.currentTime = 1;
  manager.stopAllAudio(); manager.playCaption(); manager.start(); manager.retryBlocked();
  for (const a of [moon, cry, caption]) { assert.equal(a.currentTime, 0); assert.equal(a.paused, true); assert.equal(a.plays, 1); }
  manager.stopCaption(); assert.equal(caption.src, '');
  assert.ok([...caption.listeners.values()].every(set => set.size === 0));
});

test('caption 过期禁止被拦截和迟到拒绝后的补播，但不截断已正常播放的尾音', async t => {
  const { manager, caption } = setup(t); let reject;
  caption.play = () => new Promise((_, fail) => { reject = fail; });
  manager.playCaption(); manager.expireCaptionRetry();
  reject(new DOMException('late blocked', 'NotAllowedError')); await flush();
  caption.play = FakeAudio.prototype.play; manager.retryBlocked(); manager.pause(); manager.resume();
  assert.equal(caption.plays, 0);
  const next = new EndingAudioManager(); t.after(() => next.dispose()); next.playCaption(); await flush();
  const tail = FakeAudio.instances.at(-1); tail.currentTime = 2.9; next.expireCaptionRetry();
  assert.equal(tail.paused, false); assert.equal(tail.currentTime, 2.9); tail.end();
});

test('caption 销毁后资源与监听释放，旧拒绝与回调不影响下一轮', async t => {
  const { manager, caption } = setup(t); let reject;
  caption.play = () => new Promise((_, fail) => { reject = fail; }); manager.playCaption();
  const callbacks = [...caption.listeners.values()].flatMap(s => [...s]);
  caption.currentTime = 1; manager.dispose(); manager.dispose();
  const next = new EndingAudioManager(); t.after(() => next.dispose()); next.playCaption();
  reject(new Error('old')); for (const callback of callbacks) callback(); await flush();
  manager.playCaption(); manager.retryBlocked(); manager.resume();
  assert.equal(caption.src, ''); assert.equal(caption.currentTime, 0); assert.equal(caption.paused, true);
  assert.ok([...caption.listeners.values()].every(set => set.size === 0));
  assert.equal(FakeAudio.instances.at(-1).paused, false);
});
