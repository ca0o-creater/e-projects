import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioManager } from '../src/audio/AudioManager.ts';
import { HandoffController } from '../src/interaction/handoff.ts';

class FakeAudio extends EventTarget {
  static instances = [];
  paused = true;
  currentTime = 0;
  loop = false;
  plays = 0;
  loads = 0;
  constructor(src) { super(); this.src = src; FakeAudio.instances.push(this); }
  load() { this.loads++; }
  play() { this.paused = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  end() { this.paused = true; this.dispatchEvent(new Event('ended')); }
}

function setup(t) {
  t.mock.method(globalThis, 'Audio', FakeAudio);
  FakeAudio.instances = [];
  const manager = new AudioManager('/audio/');
  const get = name => FakeAudio.instances.find(a => a.src === `/audio/${name}.wav`);
  t.after(() => manager.dispose());
  return { manager, get };
}

// Node 没有 Audio，测试仅模拟媒体事件；真实文件解码由浏览器负责。
globalThis.Audio = FakeAudio;

test('预加载七条音轨，只有环境和拖动循环；入场 ended 后启动环境且不会重复入场', t => {
  const { manager, get } = setup(t);
  manager.preload();
  assert.equal(FakeAudio.instances.length, 7);
  assert.ok(FakeAudio.instances.every(a => a.loads === 1 && a.preload === 'auto'));
  assert.deepEqual(FakeAudio.instances.filter(a => a.loop).map(a => a.src),
    ['/audio/env-kunlun-loop.wav', '/audio/sfx-drag-loop.wav']);
  manager.enterScene(); manager.enterScene();
  assert.equal(get('scene-enter').plays, 1);
  assert.equal(get('env-kunlun-loop').plays, 0);
  get('scene-enter').end();
  manager.grab();
  assert.equal(get('env-kunlun-loop').paused, false);
  assert.equal(get('sfx-grab').plays, 1);
  assert.equal(get('sfx-drag-loop').paused, false);
});

test('同一调用栈抓取再松手，立即归零拖动音；再次抓取正常播放', t => {
  const { manager, get } = setup(t);
  manager.enterScene();
  const controller = new HandoffController(() => ({ x: 1000, y: 600 }), () => {});
  controller.state = 'ready';
  controller.setPath({ x: 600, y: 600 });
  const unsubscribe = controller.subscribeState((state, previous) => manager.onHandoffState(state, previous));
  controller.input({ type: 'GRAB', point: controller.point });
  get('sfx-drag-loop').currentTime = 1.5;
  controller.input({ type: 'RELEASE' });
  assert.equal(get('sfx-drag-loop').paused, true);
  assert.equal(get('sfx-drag-loop').currentTime, 0);
  assert.equal(get('sfx-return').plays, 1);
  controller.update(10);
  controller.input({ type: 'GRAB', point: controller.point });
  assert.equal(get('sfx-drag-loop').plays, 2);
  assert.equal(get('sfx-drag-loop').paused, false);
  unsubscribe();
});

test('吸附先 catch 后 success；松手完成不重复播放；取消吸附撤销 success', t => {
  const { manager, get } = setup(t);
  manager.enterScene(); manager.grab();
  manager.onHandoffState('snapped', 'dragging');
  assert.equal(get('sfx-drag-loop').paused, true);
  assert.equal(get('sfx-success').plays, 0);
  manager.onHandoffState('completing', 'snapped');
  assert.equal(get('sfx-catch').plays, 1);
  get('sfx-catch').end();
  assert.equal(get('sfx-success').plays, 1);
  manager.catchBottle(); manager.returnBottle();
  get('sfx-catch').end();
  assert.equal(get('sfx-success').plays, 1);
  assert.equal(get('sfx-return').plays, 1);
});

test('全局停止撤销串联和循环，迟到 ended 无效；重入可重新播放', t => {
  const { manager, get } = setup(t);
  manager.enterScene(); manager.catchBottle();
  for (const audio of FakeAudio.instances) audio.currentTime = 0.2;
  manager.stopAllAudio(); manager.stopAllAudio();
  get('scene-enter').end(); get('sfx-catch').end();
  assert.ok(FakeAudio.instances.every(a => a.paused && a.currentTime === 0));
  assert.equal(get('env-kunlun-loop').plays, 0);
  assert.equal(get('sfx-success').plays, 0);
  manager.enterScene();
  assert.equal(get('scene-enter').plays, 2);
});

test('后台暂停不播放复位音；返回后恢复环境但不恢复拖动', t => {
  const { manager, get } = setup(t);
  manager.enterScene(); get('scene-enter').end(); manager.grab();
  manager.pause(); manager.returnBottle(); manager.resume();
  assert.equal(get('env-kunlun-loop').paused, false);
  assert.equal(get('sfx-return').plays, 0);
  assert.equal(get('sfx-drag-loop').paused, true);
});

test('快速暂停再恢复后，旧 play 的迟到拒绝不能停止新的入场播放', async t => {
  const { manager, get } = setup(t);
  let rejectOld;
  const enter = get('scene-enter');
  enter.play = () => new Promise((_, reject) => { rejectOld = reject; });
  manager.enterScene();
  manager.pause();
  enter.play = FakeAudio.prototype.play;
  manager.resume();
  rejectOld(new DOMException('paused', 'AbortError'));
  await Promise.resolve();
  assert.equal(enter.paused, false);
  assert.equal(get('env-kunlun-loop').plays, 0);
});
