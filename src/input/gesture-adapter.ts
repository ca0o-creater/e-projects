import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { gestureConfig as config } from '../config/gesture.config.ts';
import { PinchController, type HandCursor, type Landmark } from './pinch-controller.ts';
import type { CaptureGestureTarget } from './gesture-mapping.ts';
import { bridgeGestureInput } from './gesture-semantics.ts';
import type { InputSink, StagePoint } from './semantic.ts';

/** Owns camera, inference loop and tracking lifetime; never owns narrative state. */
export class GestureInputAdapter {
  private readonly pinch: PinchController;
  private readonly video: HTMLVideoElement;
  private readonly cursor: (cursor: HandCursor | null) => void;
  private readonly fail: (error: unknown) => void;
  private readonly active: () => boolean;
  private readonly debug: (landmarks?: readonly Landmark[]) => void;
  private stream?: MediaStream;
  private tracker?: HandLandmarker;
  private frame = 0;
  private lastInference = -Infinity;
  private lastVideoTime = -1;
  private lastDecoded = 0;
  private disposed = false;
  private readonly events = new AbortController();
  private timeout?: ReturnType<typeof setTimeout>;

  constructor(video: HTMLVideoElement, send: InputSink, canGrab: (p: StagePoint) => boolean,
    cursor: (c: HandCursor | null) => void, active: () => boolean, fail: (e: unknown) => void,
    captureTarget?: CaptureGestureTarget, debug: (landmarks?: readonly Landmark[]) => void = () => {}) {
    this.video = video; this.cursor = cursor; this.active = active; this.fail = fail;
    this.pinch = new PinchController(bridgeGestureInput(send), canGrab, captureTarget);this.debug=debug;
    window.addEventListener('blur', this.cancel, { signal: this.events.signal });
    document.addEventListener('visibilitychange', this.cancel, { signal: this.events.signal });
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('摄像头不可用，请使用 localhost 或 HTTPS');
    // A denied/pending camera request must never block the fallback switch.
    const timeout = new Promise<never>((_, reject) => {
      this.timeout = setTimeout(() => reject(new Error('摄像头或模型准备超时')), config.startupTimeoutMs);
    });
    try { await Promise.race([this.initialize(), timeout]); }
    finally { clearTimeout(this.timeout); }
  }

  private async initialize(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
    if (this.disposed) { stream.getTracks().forEach(t => t.stop()); return; }
    this.stream = stream;
    for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => {
      if (!this.disposed) this.fail(new Error('摄像头连接已中断'));
    }, { signal: this.events.signal });
    this.video.srcObject = stream;
    await this.video.play();
    if (this.disposed) return;
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    if (this.disposed) return;
    const files = await FilesetResolver.forVisionTasks(config.wasmPath);
    if (this.disposed) return;
    const tracker = await HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: config.modelPath, delegate: 'CPU' },
      runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6,
    });
    if (this.disposed) { tracker.close(); return; }
    this.tracker = tracker; this.lastDecoded = performance.now();
    this.frame = requestAnimationFrame(this.detect);
  }

  private readonly detect = (now: number): void => {
    if (this.disposed) return;
    try {
      if (!this.active() || !document.hasFocus()) this.cancel();
      else if (now - this.lastInference >= 1000 / config.inferenceFps) {
        this.lastInference = now;
        if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
          this.lastVideoTime = this.video.currentTime; this.lastDecoded = now;
          const result = this.tracker!.detectForVideo(this.video, now);
          this.debug(result.landmarks[0]);
          this.cursor(this.pinch.update(result.landmarks[0], now, this.video.videoWidth / this.video.videoHeight));
        } else if (now - this.lastDecoded >= config.lostHandMs) {
          this.pinch.missing(now); this.cursor(null);this.debug();
        }
      }
      this.frame = requestAnimationFrame(this.detect);
    } catch (error) { this.cancel(); this.fail(error); }
  };

  readonly cancel = (): void => { this.pinch.cancel(); this.cursor(null);this.debug(); };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.cancel(); this.events.abort();
    clearTimeout(this.timeout); cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach(t => t.stop());
    this.video.pause(); this.video.srcObject = null;
    this.tracker?.close(); this.tracker = undefined;
  }
}
