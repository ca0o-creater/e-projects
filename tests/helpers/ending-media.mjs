export class FakeAudio extends EventTarget {
  static instances = [];
  paused = true; currentTime = 0; playbackRate = 1; volume = 1; loop = false;
  plays = 0; loads = 0; starts = []; error = null; listeners = new Map();
  constructor(src) { super(); this.src = src; FakeAudio.instances.push(this); }
  addEventListener(type, fn) {
    super.addEventListener(type, fn);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) { super.removeEventListener(type, fn); this.listeners.get(type)?.delete(fn); }
  play() { this.paused = false; this.plays++; this.starts.push(this.currentTime); return Promise.resolve(); }
  pause() { this.paused = true; }
  load() { this.loads++; }
  removeAttribute() { this.src = ''; }
  end() { this.paused = true; this.dispatchEvent(new Event('ended')); }
}

export class Element extends EventTarget {
  children = []; style = {}; dataset = {}; classes = new Set();
  classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name) };
  currentTime = 0; playbackRate = 1; duration = 5.04; readyState = 4; paused = true; starts = [];
  append(...items) { for (const item of items) { this.children.push(item); item.parent = this; } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
  setAttribute() {} removeAttribute() {} load() {} focus() {}
  pause() { this.paused = true; }
  play() { this.paused = false; this.starts.push(this.currentTime); return Promise.resolve(); }
  requestVideoFrameCallback(fn) { this.frame = fn; return 1; }
  cancelVideoFrameCallback() { this.frame = undefined; }
}

export const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
