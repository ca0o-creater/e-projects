import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioManager } from '../src/audio/audio-manager.ts';

class FakeAudio extends EventTarget {
  static last;
  currentTime = 0; paused = true; volume = 1; readyState = 0;
  constructor(src) { super(); this.src = src; FakeAudio.last = this; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
  removeAttribute() {}
}
globalThis.Audio = FakeAudio;
globalThis.HTMLMediaElement = { HAVE_FUTURE_DATA: 3 };

test('旁白暂停引起的旧拒绝不会清掉恢复后的 ended 回调', async () => {
  const manager = new AudioManager({ intro: '/intro.wav' });
  const audio = FakeAudio.last;
  let rejectOld, ended = 0;
  audio.play = () => new Promise((_, reject) => { rejectOld = reject; });
  const pending = manager.play('intro', () => ended++);
  manager.pause();
  audio.play = FakeAudio.prototype.play;
  await manager.resume();
  rejectOld(new DOMException('paused', 'AbortError'));
  await pending;
  audio.dispatchEvent(new Event('ended'));
  assert.equal(ended, 1);
  manager.destroy();
});

test('预加载超时有界，销毁会撤销未完成的预加载', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manager = new AudioManager({ intro: '/intro.wav' });
  const failure = assert.rejects(manager.preloadAll(), /预加载失败/);
  t.mock.timers.tick(8000);
  await failure;
  const pending = manager.preloadAll();
  manager.destroy();
  await pending;
  t.mock.timers.tick(8000);
});
