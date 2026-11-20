import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Scene2AudioManager } from '../src/audio/scene2-audio-manager.ts';
import { MortalTransition } from '../src/audio/mortal-transition.ts';
import { AudioManager as ActOneAudio } from '../src/audio/AudioManager.ts';
import { SwallowController } from '../src/interaction/swallow.ts';
import { scene2Config as config } from '../src/config/scene2.config.ts';
import { SceneLifetime } from '../src/scenes/scene-lifetime.ts';

class FakeAudio extends EventTarget {
  static instances = [];
  paused = true; currentTime = 0; volume = 1; loop = false; plays = 0; loads = 0; error = null;
  listeners = new Map();
  constructor(src) { super(); this.src = src; FakeAudio.instances.push(this); }
  addEventListener(type, fn, options) {
    super.addEventListener(type, fn, options);
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

function setup(t, options) {
  FakeAudio.instances = [];
  const manager = new Scene2AudioManager();
  manager.preload();
  const elements = new Map(FakeAudio.instances.map(a => [a.src.split('/').pop().replace('.wav', ''), a]));
  const get = name => elements.get(`scene2-${name}`);
  const controller = new SwallowController(() => {});
  const life = new SceneLifetime();
  life.add(() => controller.dispose());
  life.add(() => manager.dispose());
  life.add(controller.subscribeState((next, previous) => manager.onState(next, previous)));
  t.after(() => life.dispose());
  if (options) manager.start(options);
  return { manager, controller, get, life, elements };
}
function grab(s) { s.input({ type: 'GRAB', point: s.point }); }
function move(s, progress) { s.input({ type: 'MOVE', point: s.pointAt(progress) }); }
function release(s, cancelled = false) { s.input({ type: 'RELEASE', cancelled }); }
function ready(f) { f.manager.start(); f.controller.prepare(); }
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('入场增益和压缩仅创建一次，庭院独立增益；恢复可解锁 AudioContext，离场断开释放', async t => {
  const contexts = [];
  class FakeContext {
    state = 'suspended'; destination = {}; nodes = []; sources = []; resumes = 0;
    constructor() { contexts.push(this); }
    node() {
      const node = { connected: [], disconnected: false,
        connect(target) { this.connected.push(target); }, disconnect() { this.disconnected = true; } };
      this.nodes.push(node); return node;
    }
    createMediaElementSource(audio) { this.sources.push(audio); return this.node(); }
    createGain() { return Object.assign(this.node(), { gain: { value: 1 } }); }
    createDynamicsCompressor() {
      return Object.assign(this.node(), Object.fromEntries(
        ['threshold', 'knee', 'ratio', 'attack', 'release'].map(key => [key, { value: 0 }])));
    }
    async resume() { this.state = 'running'; this.resumes++; }
    async close() { this.state = 'closed'; }
  }
  const original = globalThis.AudioContext;
  globalThis.AudioContext = FakeContext;
  t.after(() => { if (original) globalThis.AudioContext = original; else delete globalThis.AudioContext; });
  const f = setup(t);
  assert.equal(contexts.length, 0); // 预加载不创建需要用户激活的输出。
  f.manager.start(); await flush();
  const context = contexts[0];
  assert.equal(context.sources[0], f.get('intro'));
  assert.equal(context.nodes[1].gain.value, 10);
  assert.equal(context.nodes[2].threshold.value, -6);
  assert.equal(context.nodes[2].ratio.value, 12);
  f.manager.pause(); f.manager.resume(); await flush();
  assert.equal(context.sources.length, 1); // 同一元素不可重复创建 MediaElementSource。
  f.get('intro').end(); await flush();
  assert.equal(context.sources[1], f.get('courtyard-loop'));
  assert.ok(Math.abs(context.nodes[4].gain.value - 10 ** (26 / 20)) < 1e-9);
  context.state = 'suspended'; f.manager.retryBlocked();
  assert.equal(context.state, 'running');
  // 实际经过抓取、复位、充能、吞药，检查每条媒体确实进入增益/压缩链。
  f.controller.prepare(); grab(f.controller); release(f.controller);
  f.controller.update(2); grab(f.controller); move(f.controller, 1);
  f.controller.update(.4); release(f.controller);
  const gains = context.nodes.filter(node => node.gain).map(node => node.gain.value);
  assert.deepEqual(gains, [20, 26, 26, 24, 22, 32, 30].map(db => 10 ** (db / 20)));
  assert.equal(context.nodes.filter(node => node.threshold).length, 6);
  f.manager.dispose();
  assert.equal(context.state, 'closed');
  assert.ok(context.nodes.every(node => node.disconnected));
});

test('全部路径正确、预加载，只有庭院与抬臂循环；配置对齐12秒/0.4秒/4.3秒', t => {
  const { elements } = setup(t);
  assert.deepEqual([...elements.keys()], [
    'scene2-intro', 'scene2-courtyard-loop', 'scene2-grab-wrist', 'scene2-arm-lift-loop',
    'scene2-target-charge', 'scene2-arm-return', 'scene2-swallow-rise',
  ]);
  for (const [name, a] of elements) {
    assert.equal(a.src, `/audio/${name}.wav`);
    assert.equal(a.loop, ['scene2-courtyard-loop', 'scene2-arm-lift-loop'].includes(name));
    assert.equal(a.loads, 1); assert.equal(a.preload, 'auto');
  }
  assert.ok(Math.abs(config.intro.duration - 12) < 1e-9);
  assert.equal(config.arm.holdSeconds, .4);
  assert.equal(config.ending.swallowSeconds + config.ending.riseSeconds, 4.3);
});

test('正常入场只播放一次 intro，ended 才启动庭院', t => {
  const { manager, get } = setup(t);
  manager.start(); manager.start();
  assert.equal(get('intro').plays, 1); assert.equal(get('courtyard-loop').plays, 0);
  get('intro').end(); get('intro').end();
  assert.equal(get('courtyard-loop').plays, 1);
});

test('intro 播放前已加载失败、播放中 error 或 play 拒绝都回退庭院', async t => {
  for (const failure of ['preload', 'error', 'promise']) {
    const { manager, get } = setup(t);
    if (failure === 'preload') get('intro').error = { code: 4 };
    if (failure === 'promise') get('intro').play = () => Promise.reject(new Error('decode'));
    manager.start();
    if (failure === 'error') get('intro').dispatchEvent(new Event('error'));
    await flush();
    assert.equal(get('courtyard-loop').plays, 1);
    manager.dispose();
  }
});

test('skipIntro 直接启动庭院；静态预览与反复 resume 都不启动声音', t => {
  const f = setup(t, { skipIntro: true });
  assert.equal(f.get('intro').plays, 0); assert.equal(f.get('courtyard-loop').plays, 1);
  const still = setup(t, { staticPreview: true });
  still.manager.pause(); still.manager.resume(); still.manager.resume();
  assert.ok([...still.elements.values()].every(a => a.plays === 0));
});

test('真实控制器抓取启动 grab/lift，重复 MOVE 不重启循环', t => {
  const f = setup(t); ready(f); grab(f.controller);
  for (let i = 0; i < 10; i++) move(f.controller, .1);
  assert.equal(f.get('grab-wrist').plays, 1); assert.equal(f.get('arm-lift-loop').plays, 1);
  assert.equal(f.get('arm-lift-loop').paused, false);
});

test('首次进圈立即停 lift 并充能；圈内抖动和 armed 不重复充能', t => {
  const f = setup(t); ready(f); grab(f.controller);
  f.get('arm-lift-loop').currentTime = 1;
  move(f.controller, 1);
  assert.equal(f.get('arm-lift-loop').paused, true); assert.equal(f.get('arm-lift-loop').currentTime, 0);
  assert.equal(f.get('target-charge').plays, 1);
  for (let i = 0; i < 4; i++) { move(f.controller, 1); f.controller.update(.1); }
  assert.equal(f.controller.state, 'armed'); assert.equal(f.get('target-charge').plays, 1);
});

test('充能中途/armed 出圈停 charge 并恢复 lift，再进圈从头充能且不重播 grab', t => {
  const f = setup(t); ready(f); grab(f.controller);
  for (const hold of [.2, .4]) {
    move(f.controller, 1); f.controller.update(hold);
    f.get('target-charge').currentTime = .2;
    move(f.controller, 0);
    assert.equal(f.get('target-charge').paused, true); assert.equal(f.get('target-charge').currentTime, 0);
    assert.equal(f.get('arm-lift-loop').paused, false); assert.equal(f.get('arm-lift-loop').currentTime, 0);
  }
  assert.equal(f.get('target-charge').plays, 2); assert.equal(f.get('arm-lift-loop').plays, 3);
  assert.equal(f.get('grab-wrist').plays, 1);
});

test('无效松手/取消 armed 只播一次 return；ready 不重播；重新抓取正常', t => {
  for (const cancelled of [false, true]) {
    const f = setup(t); ready(f); grab(f.controller); move(f.controller, 1);
    f.controller.update(cancelled ? .4 : .2); release(f.controller, cancelled); release(f.controller, cancelled);
    assert.equal(f.get('arm-return').plays, 1);
    assert.equal(f.get('arm-lift-loop').paused, true); assert.equal(f.get('target-charge').currentTime, 0);
    f.controller.update(2); assert.equal(f.get('arm-return').plays, 1);
    grab(f.controller); assert.equal(f.get('grab-wrist').plays, 2);
    assert.equal(f.get('arm-lift-loop').paused, false);
  }
});

test('有效松手播放一次4.3秒吞药升起，complete 不重播且庭院继续', t => {
  const f = setup(t); ready(f); f.get('intro').end(); grab(f.controller);
  move(f.controller, 1); f.controller.update(.4); release(f.controller); release(f.controller);
  assert.equal(f.controller.state, 'swallowing'); assert.equal(f.get('swallow-rise').plays, 1);
  for (const name of ['grab-wrist', 'arm-lift-loop', 'target-charge', 'arm-return']) {
    assert.equal(f.get(name).paused, true); assert.equal(f.get(name).currentTime, 0);
  }
  f.controller.update(4.3); assert.equal(f.controller.state, 'complete');
  assert.equal(f.get('swallow-rise').plays, 1); assert.equal(f.get('courtyard-loop').paused, false);
});

test('销毁撤销监听，迟到 ended/error 不启动庭院；旧实例不能影响重入', t => {
  const f = setup(t); f.manager.start();
  const lateEnded = [...f.get('intro').listeners.get('ended')][0];
  f.get('intro').currentTime = 3; f.life.dispose(); lateEnded();
  f.get('intro').end(); f.get('intro').dispatchEvent(new Event('error'));
  assert.equal(f.get('courtyard-loop').plays, 0);
  for (const a of f.elements.values()) {
    assert.equal(a.paused, true); assert.equal(a.currentTime, 0); assert.equal(a.src, '');
    assert.ok([...a.listeners.values()].every(set => set.size === 0));
  }
  const again = setup(t); again.manager.start();
  assert.equal(again.get('intro').plays, 1); assert.equal(again.get('intro').currentTime, 0);
});

test('暂停清掉短反馈，取消抓取不发复位声；返回只恢复背景/剧情进度', async t => {
  const f = setup(t); ready(f); await flush();
  f.get('intro').currentTime = 5; f.manager.pause(); f.manager.resume();
  assert.equal(f.get('intro').currentTime, 5); assert.equal(f.get('intro').paused, false);
  f.get('intro').end(); grab(f.controller); move(f.controller, 1);
  f.manager.pause(); release(f.controller, true); f.manager.resume();
  assert.equal(f.get('arm-return').plays, 0);
  assert.equal(f.get('arm-lift-loop').paused, true); assert.equal(f.get('target-charge').paused, true);
  f.controller.update(2); grab(f.controller); move(f.controller, 1); f.controller.update(.4); release(f.controller);
  await flush(); f.get('swallow-rise').currentTime = 1.3;
  f.get('courtyard-loop').currentTime = 10;
  f.manager.pause(); f.manager.resume();
  assert.equal(f.get('swallow-rise').currentTime, 1.3); assert.equal(f.get('swallow-rise').paused, false);
  assert.equal(f.get('courtyard-loop').currentTime, 10);
});

test('后台收到 intro ended 时，返回前不启动庭院', t => {
  const f = setup(t); f.manager.start(); f.manager.pause(); f.get('intro').end();
  assert.equal(f.get('courtyard-loop').plays, 0);
  f.manager.resume(); assert.equal(f.get('courtyard-loop').plays, 1);
});

test('迟到 play 拒绝不影响暂停恢复或较新的同轨播放', async t => {
  const f = setup(t);
  let rejectOld;
  f.get('intro').play = () => new Promise((_, reject) => { rejectOld = reject; });
  f.manager.start(); f.manager.pause();
  f.get('intro').play = FakeAudio.prototype.play; f.manager.resume();
  rejectOld(new Error('old request')); await flush();
  assert.equal(f.get('intro').paused, false); assert.equal(f.get('courtyard-loop').plays, 0);
  f.controller.prepare();
  f.get('arm-lift-loop').play = () => new Promise((_, reject) => { rejectOld = reject; });
  grab(f.controller); move(f.controller, 1);
  f.get('arm-lift-loop').play = FakeAudio.prototype.play; move(f.controller, 0);
  rejectOld(new Error('old lift')); await flush();
  assert.equal(f.get('arm-lift-loop').paused, false);
});

test('自动播放被拦截后庭院可由真实输入重试，失败的短交互音不会迟到重播', async t => {
  const f = setup(t);
  f.get('intro').play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
  f.get('courtyard-loop').play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
  f.manager.start(); await flush(); await flush();
  f.get('courtyard-loop').play = FakeAudio.prototype.play;
  f.manager.retryBlocked(); await flush();
  assert.equal(f.get('courtyard-loop').plays, 1);
});

test('前往凡间需交接完成，重复/重入点击不重复切幕；第一幕清理不会截断转场', t => {
  FakeAudio.instances = [];
  const transition = new MortalTransition(); transition.preload();
  const sound = FakeAudio.instances[0];
  assert.equal(sound.src, '/audio/transition-to-mortal.wav'); assert.equal(sound.loop, false);
  t.after(() => transition.dispose());
  const firstAudio = new ActOneAudio('/audio/'); firstAudio.enterScene();
  const firstLife = new SceneLifetime(); firstLife.add(() => firstAudio.dispose());
  let scene = 'first', complete = false, mounts = 0;
  const allowed = () => scene === 'first' && complete;
  const mount = () => {
    mounts++;
    transition.navigate(allowed, mount); // 同步重入也被锁住。
    firstLife.dispose();
    assert.equal(sound.paused, false);
    scene = 'second';
  };
  assert.equal(transition.navigate(allowed, mount), false);
  complete = true;
  transition.navigate(allowed, mount); transition.navigate(allowed, mount);
  assert.equal(mounts, 1); assert.equal(sound.plays, 1);
  sound.currentTime = .5; transition.pause(); transition.resume();
  assert.equal(sound.currentTime, .5);
  transition.stopAllAudio(); assert.equal(sound.currentTime, 0); assert.equal(sound.paused, true);
});

test('状态通知可注销且同圈 MOVE 不重复通知', () => {
  const controller = new SwallowController(() => {}), notifications = [];
  const unsubscribe = controller.subscribeState((next, previous) => notifications.push([next, previous]));
  controller.prepare(); grab(controller); move(controller, 1); move(controller, 1);
  assert.equal(notifications.length, 3);
  assert.equal(notifications[2][0].inTarget, true);
  unsubscribe(); move(controller, 0); controller.dispose();
  assert.equal(notifications.length, 3);
});

test('抓取/充能压低庭院，吞药升起进一步避让；音效结束才恢复背景且不重播', async t => {
  const f = setup(t); ready(f); f.get('intro').end();
  const environment = f.get('courtyard-loop');
  environment.currentTime = 7;
  grab(f.controller); assert.equal(environment.volume, .5);
  move(f.controller, 1); f.controller.update(.4); release(f.controller);
  assert.equal(environment.volume, .35);
  await flush();
  f.get('swallow-rise').currentTime = 1.3;
  f.manager.pause(); f.manager.resume();
  assert.equal(environment.volume, .35);
  assert.equal(f.get('swallow-rise').currentTime, 1.3);
  f.controller.update(4.3);
  assert.equal(environment.volume, .35);
  f.get('swallow-rise').end();
  assert.equal(environment.volume, 1);
  assert.equal(environment.currentTime, 7);
  assert.equal(environment.plays, 2); // 初播一次，暂停后续播一次，无额外重启。
});

test('吞药音播放失败、复位完成和全局停止都会解除环境避让', async t => {
  const f = setup(t); ready(f); f.get('intro').end();
  grab(f.controller); release(f.controller); f.controller.update(2);
  assert.equal(f.get('courtyard-loop').volume, 1);
  f.get('swallow-rise').play = () => Promise.reject(new Error('decode'));
  grab(f.controller); move(f.controller, 1); f.controller.update(.4); release(f.controller);
  await flush();
  assert.equal(f.get('courtyard-loop').volume, 1);
  f.manager.stopAllAudio();
  f.manager.start({ skipIntro: true });
  assert.equal(f.get('courtyard-loop').volume, 1);
});
