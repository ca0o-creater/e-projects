import { PointerInputAdapter } from './pointer-adapter.ts';
import { GestureInputAdapter } from './gesture-adapter.ts';
import { gestureConfig } from '../config/gesture.config.ts';
import type { HandCursor } from './pinch-controller.ts';
import type { InputSink, StagePoint } from './semantic.ts';
import type { CaptureGestureTarget } from './gesture-mapping.ts';
import { GesturePreview } from './gesture-preview.ts';

/** One camera session, rebindable across scenes. Only one source owns stage input. */
export class SceneInputAdapter {
  private source?: PointerInputAdapter | GestureInputAdapter;
  private generation = 0;
  private disposed = false;
  private readonly stage: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private send: InputSink;
  private canGrab: (point: StagePoint) => boolean;
  private captureTarget?: CaptureGestureTarget;
  private bound = true;
  private readonly uiPointers = new Set<number>();
  private readonly dispatch:InputSink = event=>{if(this.bound)this.send(event);};
  private readonly hit=(p:StagePoint)=>this.bound&&this.uiPointers.size===0&&this.canGrab(p);
  private readonly capture=()=>this.bound?this.captureTarget?.()??null:null;
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
    this.panel.className = 'input-panel'; this.panel.setAttribute('aria-label', '舞台输入模式');
    const label = document.createElement('label'); label.textContent = '输入方式 ';
    this.mode.setAttribute('aria-label', '输入方式');
    for (const [value, text] of [['pointer','触摸/鼠标替代模式'], ['gesture','摄像头手势（三幕通用）']]) {
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
    const options={signal:this.events.signal,capture:true};
    // Capture phase precedes button handlers, including the hold-to-assist pointerdown.
    window.addEventListener('pointerdown',event=>{
      if(!this.isUI(event.target))return;
      this.uiPointers.add(event.pointerId);this.reset();
    },options);
    for(const type of ['pointerup','pointercancel'])window.addEventListener(type,event=>{
      this.uiPointers.delete((event as PointerEvent).pointerId);
    },options);
    window.addEventListener('click',event=>{if(this.isUI(event.target))this.reset();},options);
    window.addEventListener('blur',()=>{this.uiPointers.clear();this.reset();},options);
    this.usePointer();
  }

  private isUI(target:EventTarget|null):boolean {
    return Boolean((target as Element|null)?.closest?.('button,select,input,a,[role="button"]'));
  }

  bind(send:InputSink,canGrab:(p:StagePoint)=>boolean,captureTarget:CaptureGestureTarget):void {
    this.reset(); // Release to the old controller BEFORE changing the receiver.
    this.send=send;this.canGrab=canGrab;this.captureTarget=captureTarget;this.bound=true;
  }
  unbind():void {
    this.reset();this.bound=false;this.send=()=>{};this.canGrab=()=>false;this.captureTarget=undefined;
    this.canvas.style.cursor='default';
  }
  reset():void {this.source?.cancel();}

  private usePointer(message = '可用鼠标或触摸拖动当前发光控制点。'): void {
    if (this.disposed) return;
    ++this.generation; this.source?.dispose();
    this.mode.value = 'pointer'; this.video.hidden = true; this.dot.hidden = true;
    this.preview.setEnabled(false);
    this.status.textContent = message; this.panel.dataset.mode = 'pointer';
    this.source = new PointerInputAdapter(this.canvas, this.dispatch, this.hit);
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
    const adapter = new GestureInputAdapter(this.video, this.dispatch, this.hit, this.showCursor,
      () => this.bound && !this.stage.hidden && !document.hidden, fallback, this.capture,
      landmarks=>this.preview.draw(this.video,landmarks));
    this.source = adapter;
    try {
      await adapter.start();
      if (this.disposed || id !== this.generation) { adapter.dispose(); return; }
      this.panel.dataset.mode = 'gesture'; this.preview.setEnabled(true);
      this.status.textContent = '绿框内张开手对准光点，捏合后移动；第二、三幕向上抬手。切幕后先张开再捏合。';
    } catch (error) { fallback(error); }
  }

  private readonly showCursor = (cursor: HandCursor | null): void => {
    this.preview.updateMetrics(cursor?.diagnostics??null);
    this.dot.hidden = !cursor;
    if (!cursor) return;
    this.dot.style.left = `${cursor.point.x / gestureConfig.stage.width * 100}%`;
    this.dot.style.top = `${cursor.point.y / gestureConfig.stage.height * 100}%`;
    this.dot.dataset.grabbing = String(cursor.grabbing);
    this.dot.dataset.available = String(cursor.available);
    this.dot.dataset.insideRoi = String(cursor.insideRoi);
  };

  cancel(): void { this.reset(); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; ++this.generation;
    this.source?.dispose(); this.events.abort(); this.preview.dispose();this.panel.remove(); this.dot.remove();
    this.bound=false;this.send=()=>{};this.canGrab=()=>false;this.captureTarget=undefined;this.uiPointers.clear();
  }
}

// Compatibility for existing callers/tests; all scenes now use SceneInputAdapter.
export { SceneInputAdapter as ActOneInput };
