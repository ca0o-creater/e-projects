import type { InputSink, StagePoint } from './semantic.ts';
import { actOneConfig } from '../config/act-one.ts';

export class PointerInputAdapter {
  private pointerId: number | null = null;
  private readonly events = new AbortController();
  private readonly canvas: HTMLCanvasElement;
  private readonly send: InputSink;
  private readonly canGrab: (point: StagePoint) => boolean;

  constructor(canvas: HTMLCanvasElement, send: InputSink, canGrab: (point: StagePoint) => boolean) {
    this.canvas = canvas;
    this.send = send;
    this.canGrab = canGrab;
    const options = { signal: this.events.signal };
    canvas.addEventListener('pointerdown', this.down, options);
    canvas.addEventListener('pointermove', this.move, options);
    canvas.addEventListener('pointerup', this.up, options);
    canvas.addEventListener('pointercancel', this.cancel, options);
    canvas.addEventListener('lostpointercapture', this.cancel, options);
    window.addEventListener('blur', this.cancel, options);
  }

  private point(event: PointerEvent): StagePoint {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * actOneConfig.stage.width / rect.width,
      y: (event.clientY - rect.top) * actOneConfig.stage.height / rect.height };
  }

  private readonly down = (event: PointerEvent): void => {
    if (event.button !== 0 || this.pointerId !== null || !event.isPrimary) return;
    const point = this.point(event);
    if (!this.canGrab(point)) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.send({ type: 'GRAB', point });
    this.canvas.style.cursor = 'grabbing';
  };

  private readonly move = (event: PointerEvent): void => {
    if (this.pointerId === event.pointerId) {
      const point=this.point(event);
      if(point.x<0 || point.x>actOneConfig.stage.width || point.y<0 || point.y>actOneConfig.stage.height) this.cancel();
      else this.send({ type: 'MOVE', point });
    }
    else if (this.pointerId === null) this.canvas.style.cursor = this.canGrab(this.point(event)) ? 'grab' : 'default';
  };

  private readonly up = (event: PointerEvent): void => {
    if (event.pointerId === this.pointerId) this.release(false);
  };

  readonly cancel = (): void => this.release(true);

  private release(cancelled: boolean): void {
    const id = this.pointerId;
    if (id === null) return;
    this.pointerId = null; // 先清空，避免 lostpointercapture 再次派发。
    this.send({ type: 'RELEASE', cancelled });
    if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    this.canvas.style.cursor = 'default';
  }

  dispose(): void {
    this.cancel();
    this.events.abort();
  }
}
