import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MoonTransition } from '../src/audio/moon-transition.ts';
import { Scene2AudioManager } from '../src/audio/scene2-audio-manager.ts';
import { SceneLifetime } from '../src/scenes/scene-lifetime.ts';
import { ActTwoScene } from '../src/scenes/act-two.ts';
import { SwallowController } from '../src/interaction/swallow.ts';
import { scene2Config } from '../src/config/scene2.config.ts';
import { scene3Config } from '../src/config/scene3.config.ts';

class FakeAudio extends EventTarget {
  static instances = [];
  paused = true; currentTime = 0; loop = false; plays = 0; loads = 0; error = null;
  starts = []; listeners = new Map();
  constructor(src) { super(); this.src = src; FakeAudio.instances.push(this); }
  addEventListener(type, fn) {
    super.addEventListener(type, fn);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) { super.removeEventListener(type, fn); this.listeners.get(type)?.delete(fn); }
  play() { this.plays++; this.starts.push(this.currentTime); this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() { this.loads++; }
  removeAttribute() { this.src = ''; }
  end() { this.paused = true; this.dispatchEvent(new Event('ended')); }
}
globalThis.Audio = FakeAudio;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

function setup(t) {
  FakeAudio.instances = [];
  const transition = new MoonTransition(); transition.preload();
  const sound = FakeAudio.instances[0];
  const sceneAudio = new Scene2AudioManager(); sceneAudio.start({ skipIntro: true });
  const courtyard = FakeAudio.instances.find(a => a.src === '/audio/scene2-courtyard-loop.wav');
  const life = new SceneLifetime();
  const swallow = new SwallowController(() => {});
  // 使用真实场景的点击方法和资格 getter，隔离与本测试无关的 Pixi 纹理构造。
  const source = {
    swallow, destroyed: false, navigating: false, moon: { eventMode: 'static' }, skyHit: { eventMode: 'static' },
    get canNavigateToMoon() {
      return Object.getOwnPropertyDescriptor(ActTwoScene.prototype, 'canNavigateToMoon').get.call(this);
    },
    emit(name) { if (name === 'navigate-to-moon') { emitted++; navigate(); } },
  };
  let current = source, emitted = 0, mounts = 0;
  const navigate = () => transition.navigate(() => current === source && source.canNavigateToMoon, () => {
    life.dispose(); current = { third: true }; mounts++;
  });
  life.add(() => { source.destroyed = true; swallow.dispose(); });
  life.add(() => sceneAudio.dispose());
  t.after(() => { life.dispose(); transition.dispose(); });
  const unlock = () => {
    swallow.prepare(); swallow.input({ type: 'GRAB', point: swallow.point });
    swallow.input({ type: 'MOVE', point: swallow.pointAt(1) }); swallow.update(.4);
    swallow.input({ type: 'RELEASE' }); swallow.update(4.3);
  };
  return { transition, sound, courtyard, source, life, navigate, unlock,
    click: () => ActTwoScene.prototype.requestMoon.call(source),
    mounts: () => mounts, emitted: () => emitted };
}

test('准确路径/非循环，预加载和第三幕直接预览不会自动播放', async t => {
  const { sound, transition } = setup(t);
  assert.equal(sound.src, '/audio/transition-to-moon.wav'); assert.equal(sound.loop, false);
  assert.equal(sound.preload, 'auto'); assert.equal(sound.loads, 1); assert.equal(sound.plays, 0);
  transition.pause(); transition.resume(); transition.retryBlocked(); await flush();
  assert.equal(sound.plays, 0); assert.equal(scene3Config.introSeconds, 2.5);
});

test('提前点击不播放、不切幕、不占锁；包括明月已亮但吞药升起尚未完成', async t => {
  const f = setup(t);
  for (const [state, elapsed] of [['ready', 100], ['swallowing', 4.3], ['complete', 2.4], ['complete', 3]]) {
    f.source.swallow.state = state; f.source.swallow.endingElapsed = elapsed;
    f.click(); assert.equal(f.navigate(), false);
  }
  await flush();
  assert.equal(f.sound.plays, 0); assert.equal(f.mounts(), 0); assert.equal(f.emitted(), 0);
  f.source.swallow.state = 'complete'; f.source.swallow.endingElapsed = 4.3;
  f.click(); assert.equal(f.sound.plays, 1); await flush(); assert.equal(f.mounts(), 1);
});

test('有效点击同步播放，微任务立即挂载不等 ended；双击及天空重复请求只触发一次', async t => {
  const f = setup(t); f.unlock(); f.sound.currentTime = 1;
  f.click();
  assert.equal(f.sound.plays, 1); assert.equal(f.sound.starts[0], 0);
  assert.equal(f.mounts(), 0); // 尚在点击栈中，显示树安全地留到微任务销毁。
  f.click(); f.click(); assert.equal(f.navigate(), false);
  assert.equal(f.source.moon.eventMode, 'none'); assert.equal(f.source.skyHit.eventMode, 'none');
  await flush();
  assert.equal(f.mounts(), 1); assert.equal(f.emitted(), 1); assert.equal(f.sound.paused, false);
  assert.equal(f.navigate(), false); assert.equal(f.sound.plays, 1);
});

test('第二幕清理停止庭院但保留转场；第三幕2.5秒内不被生命周期清理截断', async t => {
  const f = setup(t); f.unlock(); f.click(); await flush();
  assert.equal(f.courtyard.paused, true); assert.equal(f.courtyard.currentTime, 0);
  assert.equal(f.courtyard.src, ''); assert.equal(f.source.destroyed, true);
  for (const time of [0, .5, 1.5, 2.49]) {
    f.sound.currentTime = time; f.life.dispose();
    assert.equal(f.sound.paused, false); assert.equal(f.sound.currentTime, time);
  }
  f.sound.end();
  assert.ok([...f.sound.listeners.values()].every(list => list.size === 0));
  f.transition.resume(); assert.equal(f.sound.plays, 1);
});

test('同步重入与微任务等待期间重复调用均受锁保护', async t => {
  const f = setup(t); f.unlock();
  f.sound.play = function () {
    assert.equal(f.navigate(), false);
    return FakeAudio.prototype.play.call(this);
  };
  assert.equal(f.navigate(), true); assert.equal(f.navigate(), false);
  await flush(); assert.equal(f.mounts(), 1); assert.equal(f.sound.plays, 1);
});

test('退出全屏/后台暂停保留进度，恢复不从头重播', async t => {
  const f = setup(t); f.unlock(); f.click(); await flush();
  f.sound.currentTime = 1.2; f.transition.pause();
  assert.equal(f.sound.paused, true); assert.equal(f.sound.currentTime, 1.2);
  f.transition.resume(); await flush(); f.transition.resume();
  assert.equal(f.sound.paused, false); assert.deepEqual(f.sound.starts, [0, 1.2]);
});

test('较早 play 的迟到拒绝不能停止暂停恢复后的新播放', async t => {
  const f = setup(t); f.unlock();
  let reject;
  f.sound.play = () => new Promise((_, fail) => { reject = fail; });
  f.click(); await flush(); f.transition.pause();
  f.sound.play = FakeAudio.prototype.play; f.transition.resume();
  reject(new DOMException('paused', 'AbortError')); await flush();
  assert.equal(f.sound.paused, false); assert.equal(f.mounts(), 1);
});

test('单次转场被自动播放策略拦截后可重试，不再次挂载；结束后不再重试', async t => {
  const f = setup(t); f.unlock();
  f.sound.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
  f.click(); await flush(); assert.equal(f.mounts(), 1);
  f.sound.play = FakeAudio.prototype.play; f.transition.retryBlocked(); await flush();
  assert.equal(f.sound.plays, 1); assert.equal(f.sound.starts[0], 0);
  f.sound.end(); f.transition.retryBlocked();
  assert.equal(f.sound.plays, 1); assert.equal(f.mounts(), 1);
});

test('dispose/pagehide 清零并撤销回调，迟到 ended/error 无副作用', async t => {
  const f = setup(t); f.unlock(); f.click(); await flush();
  const callbacks = [...f.sound.listeners.values()].flatMap(set => [...set]);
  f.sound.currentTime = 1.5; f.transition.dispose(); f.transition.dispose();
  for (const callback of callbacks) callback();
  f.sound.end(); f.sound.dispatchEvent(new Event('error')); f.transition.resume(); f.transition.retryBlocked();
  assert.equal(f.sound.paused, true); assert.equal(f.sound.currentTime, 0); assert.equal(f.sound.src, '');
  assert.equal(f.sound.plays, 1); assert.equal(f.mounts(), 1);
  assert.ok([...f.sound.listeners.values()].every(set => set.size === 0));
});

test('微任务执行前销毁/停止或失去转场资格，不得挂载旧请求', async t => {
  for (const cancel of ['dispose', 'stop', 'scene']) {
    const f = setup(t); f.unlock(); f.click();
    if (cancel === 'dispose') f.transition.dispose();
    else if (cancel === 'stop') f.transition.stopAllAudio();
    else f.life.dispose();
    await flush(); assert.equal(f.mounts(), 0); assert.equal(f.sound.paused, true);
  }
});

test('重演后新的有效转场从头播放，旧 Promise 拒绝不影响新一轮', async t => {
  const f = setup(t);
  let allowed = true, mounted = 0, reject;
  f.sound.play = () => new Promise((_, fail) => { reject = fail; });
  f.transition.navigate(() => allowed, () => { allowed = false; mounted++; }); await flush();
  f.transition.stopAllAudio(); f.sound.currentTime = 2;
  f.sound.play = FakeAudio.prototype.play; allowed = true;
  f.transition.navigate(() => allowed, () => { allowed = false; mounted++; });
  reject(new Error('old playback')); await flush();
  assert.equal(mounted, 2); assert.equal(f.sound.starts[0], 0); assert.equal(f.sound.paused, false);
});

test('音频解码失败不阻塞第三幕画面出现', async t => {
  const f = setup(t); f.unlock(); f.sound.error = { code: 4 }; f.click(); await flush();
  assert.equal(f.mounts(), 1); assert.equal(f.sound.paused, true);
});
