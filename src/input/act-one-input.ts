import { PointerInputAdapter } from './pointer-adapter.ts';
import { GestureInputAdapter } from './gesture-adapter.ts';
import { gestureConfig } from '../config/gesture.config.ts';
import type { HandCursor } from './pinch-controller.ts';
import type { InputSink, StagePoint } from './semantic.ts';
import type { CaptureGestureTarget } from './gesture-mapping.ts';
import { GesturePreview } from './gesture-preview.ts';

/** First-act-only mode owner: at most one input source may be active. */
export class ActOneInput {
  private source?: PointerInputAdapter | GestureInputAdapter;
  private generation = 0;
  private disposed = false;
  private readonly stage: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly send: InputSink;
  private readonly canGrab: (point: StagePoint) => boolean;
  private readonly captureTarget?: CaptureGestureTarget;
  private readonly preview: GesturePreview;
  private readonly panel = document.createElement('section');
  private readonly mode = document.createElement('select');
  private readonly status = document.createElement('p');
  private readonly video = document.createElement('video');
  private readonly dot = document.createElement('div');
  private readonly events = new AbortController();

  constructor(stage: HTMLElement, canvas: HTMLCanvasElement, send: InputSink, canGrab: (p: StagePoint) => boolean, captureTarget?: CaptureGestureTarget) {
    this.stage = stage; this.canvas = canvas; this.send = send; this.canGrab = canGrab;
    this.captureTarget = captureTarget;
    this.panel.className = 'input-panel'; this.panel.setAttribute('aria-label', '第一幕输入模式');
    const label = document.createElement('label'); label.textContent = '输入方式 ';
    this.mode.setAttribute('aria-label', '输入方式');
    for (const [value, text] of [['pointer','触摸/鼠标替代模式'], ['gesture','摄像头手势（第一幕试用）']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; this.mode.append(option);
    }
    label.append(this.mode);
    this.status.setAttribute('role', 'status');
    this.video.muted = true; this.video.playsInline = true; this.video.autoplay = true;
    this.video.hidden = true; this.video.setAttribute('aria-label', '本地摄像头镜像预览');
    this.dot.className = 'gesture-cursor'; this.dot.hidden = true; this.dot.setAttribute('aria-hidden', 'true');
    this.panel.append(label, this.status, this.video); stage.append(this.panel, this.dot);
    this.preview=new GesturePreview(stage,this.panel);
    this.mode.addEventListener('change', () => {
      if (this.mode.value === 'gesture') void this.useGesture(); else this.usePointer();
    }, { signal: this.events.signal });
    this.usePointer();
  }

  private usePointer(message = '可用鼠标或触摸拖动药瓶。'): void {
    if (this.disposed) return;
    ++this.generation; this.source?.dispose();
    this.mode.value = 'pointer'; this.video.hidden = true; this.dot.hidden = true;
    this.preview.setEnabled(false);
    this.status.textContent = message; this.panel.dataset.mode = 'pointer';
    this.source = new PointerInputAdapter(this.canvas, this.send, this.canGrab);
  }

  private async useGesture(): Promise<void> {
    const id = ++this.generation;
    this.source?.dispose(); this.canvas.style.cursor = 'default';
    this.panel.dataset.mode = 'loading'; this.status.textContent = '请允许摄像头，正在准备手势识别…';
    const fallback = (error: unknown) => {
      if (this.disposed || id !== this.generation) return;
      const reason = error instanceof DOMException && error.name === 'NotAllowedError' ? '未获摄像头权限'
        : error instanceof Error ? error.message : '摄像头不可用';
      this.usePointer(`${reason}，已切回触摸/鼠标替代模式。`);
    };
    const adapter = new GestureInputAdapter(this.video, this.send, this.canGrab, this.showCursor,
      () => !this.stage.hidden && !document.hidden, fallback, this.captureTarget,
      landmarks=>this.preview.draw(this.video,landmarks));
    this.source = adapter;
    try {
      await adapter.start();
      if (this.disposed || id !== this.generation) { adapter.dispose(); return; }
      this.panel.dataset.mode = 'gesture'; this.preview.setEnabled(true);
      this.status.textContent = '绿框内张开手对准药瓶，捏合后相对移动，张开松手。画面仅在本机处理。';
    } catch (error) { fallback(error); }
  }

  private readonly showCursor = (cursor: HandCursor | null): void => {
    this.dot.hidden = !cursor;
    if (!cursor) return;
    this.dot.style.left = `${cursor.point.x / gestureConfig.stage.width * 100}%`;
    this.dot.style.top = `${cursor.point.y / gestureConfig.stage.height * 100}%`;
    this.dot.dataset.grabbing = String(cursor.grabbing);
    this.dot.dataset.available = String(cursor.available);
    this.dot.dataset.insideRoi = String(cursor.insideRoi);
  };

  cancel(): void { this.source?.cancel(); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; ++this.generation;
    this.source?.dispose(); this.events.abort(); this.preview.dispose();this.panel.remove(); this.dot.remove();
  }
}
