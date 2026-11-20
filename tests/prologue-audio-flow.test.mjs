import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrologueAudioFlow } from '../src/audio/prologue-audio-flow.ts';

test('留白在后台冻结，返回继续剩余时间；跳过撤销下一段', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  const calls = [];
  let ended;
  const audio = {
    stop() {}, pause() {}, async resume() {},
    async play(track, callback) { calls.push(track); ended = callback; },
  };
  const flow = new PrologueAudioFlow(audio, { introGapMs: 1500, endingGapMs: 2000 }, {
    showIntro() {}, showJourney() {}, beginEnding() {}, complete() { calls.push('complete'); },
  });
  flow.start(); ended();
  now = 500; t.mock.timers.tick(500); flow.pause();
  now = 5500; t.mock.timers.tick(5000);
  assert.deepEqual(calls, ['intro']);
  await flow.resume();
  t.mock.timers.tick(999); assert.deepEqual(calls, ['intro']);
  t.mock.timers.tick(1); assert.deepEqual(calls, ['intro', 'journey']);
  ended(); flow.pause(); t.mock.timers.tick(5000);
  assert.equal(flow.state, 'journey-gap');
  await flow.resume(); t.mock.timers.tick(1999);
  assert.equal(flow.state, 'journey-gap');
  t.mock.timers.tick(1); assert.equal(flow.state, 'complete');
  flow.start(); ended(); flow.skip(); t.mock.timers.tick(5000);
  assert.deepEqual(calls, ['intro', 'journey', 'complete', 'intro', 'complete']);
  flow.dispose();
});
