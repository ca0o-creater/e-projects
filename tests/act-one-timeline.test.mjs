import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleTitle, cloudOffset } from '../src/scenes/act-one-timeline.ts';
import { actOneConfig } from '../src/config/act-one.ts';

test('先展示布景，题字降落后完整停留两秒，最后消失', () => {
  const timing = actOneConfig.title;
  const arrival = timing.delay + timing.enter;
  assert.equal(sampleTitle(0, timing).alpha, 0);
  assert.equal(sampleTitle(timing.delay - 0.01, timing).phase, 'establishing');
  const entering = sampleTitle(timing.delay + timing.enter / 2, timing);
  assert.ok(entering.alpha > 0 && entering.alpha < 1);
  assert.ok(entering.progress > 0 && entering.progress < 1);
  assert.equal(timing.hold, 2);
  for (const t of [arrival, arrival + 1, arrival + 1.999]) {
    assert.deepEqual(sampleTitle(t, timing), { phase: 'title-hold', progress: 1, alpha: 1 });
  }
  assert.equal(sampleTitle(arrival + 3, timing).phase, 'title-exit');
  assert.equal(sampleTitle(arrival + timing.hold + timing.exit, timing).alpha, 0);
  assert.equal(sampleTitle(3600, timing).phase, 'ambient');
});

test('云层左移，前景更快，长时间循环不累积位置误差', () => {
  const width = actOneConfig.stage.width;
  const offsets = actOneConfig.clouds.map(layer => cloudOffset(10, layer.speed, width));
  assert.ok(offsets[2] < offsets[1] && offsets[1] < offsets[0] && offsets[0] < 0);
  for (const { speed } of actOneConfig.clouds) {
    assert.ok(Math.abs(cloudOffset(width / speed, speed, width)) < 0.001);
    const offset = cloudOffset(36000, speed, width);
    assert.ok(offset > -width && offset <= 0);
  }
});
