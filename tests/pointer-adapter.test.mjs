import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PointerInputAdapter } from '../src/input/pointer-adapter.ts';

class Canvas extends EventTarget {
  style = {};
  captures = new Set();
  getBoundingClientRect() { return { left: 120, top: 60, width: 960, height: 540 }; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) {
    this.captures.delete(id);
    this.dispatchEvent(pointer('lostpointercapture', { pointerId: id }));
  }
}
function pointer(type, properties = {}) {
  return Object.assign(new Event(type, { cancelable: true }), {
    pointerId: 1, button: 0, isPrimary: true, clientX: 600, clientY: 330, ...properties,
  });
}

test('输入适配器换算16:9舞台坐标、只抓药瓶、屏外松手仅发送一次RELEASE', () => {
  globalThis.window = new EventTarget();
  const canvas = new Canvas(), events = [];
  const adapter = new PointerInputAdapter(canvas, e => events.push(e), p => p.x === 960 && p.y === 540);
  canvas.dispatchEvent(pointer('pointerdown', { clientX: 0 }));
  assert.equal(events.length, 0);
  canvas.dispatchEvent(pointer('pointerdown', { button: 2 }));
  assert.equal(events.length, 0);
  canvas.dispatchEvent(pointer('pointerdown'));
  assert.deepEqual(events[0], { type: 'GRAB', point: { x: 960, y: 540 } });
  assert.ok(canvas.hasPointerCapture(1));
  canvas.dispatchEvent(pointer('pointerdown', { pointerId: 2, isPrimary: false }));
  canvas.dispatchEvent(pointer('pointermove', { pointerId: 2 }));
  assert.equal(events.length, 1);
  canvas.dispatchEvent(pointer('pointermove', { clientX: 1200, clientY: -60 }));
  assert.deepEqual(events[1], { type: 'MOVE', point: { x: 2160, y: -240 } });
  canvas.dispatchEvent(pointer('pointerup'));
  canvas.dispatchEvent(pointer('pointerup'));
  assert.deepEqual(events[2], { type: 'RELEASE', cancelled: false });
  assert.equal(events.length, 3);
  assert.equal(canvas.hasPointerCapture(1), false);
  adapter.dispose();
  delete globalThis.window;
});

test('输入适配器取消、失焦、销毁均清除捕获并派发取消，销毁后无输入', () => {
  globalThis.window = new EventTarget();
  const canvas = new Canvas(), events = [];
  const adapter = new PointerInputAdapter(canvas, e => events.push(e), () => true);
  for (const cancel of [() => canvas.dispatchEvent(pointer('pointercancel')), () => window.dispatchEvent(new Event('blur')), () => adapter.dispose()]) {
    canvas.dispatchEvent(pointer('pointerdown'));
    cancel();
    assert.deepEqual(events.at(-1), { type: 'RELEASE', cancelled: true });
    assert.equal(canvas.hasPointerCapture(1), false);
  }
  const count = events.length;
  canvas.dispatchEvent(pointer('pointerdown'));
  assert.equal(events.length, count);
  delete globalThis.window;
});
