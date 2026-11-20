import type { HandoffState } from '../interaction/handoff.ts';

const tracks = {
  enter: 'scene-enter.wav',
  environment: 'env-kunlun-loop.wav',
  grab: 'sfx-grab.wav',
  drag: 'sfx-drag-loop.wav',
  catch: 'sfx-catch.wav',
  return: 'sfx-return.wav',
  success: 'sfx-success.wav',
} as const;
type Track = keyof typeof tracks;

/** 第一幕音效：背景、拖动、短音效可以同时播放，同一文件只保留一个实例。 */
export class AudioManager {
  private readonly audio = new Map<Track, HTMLAudioElement>();
  private readonly pending = new Map<Track, () => void>();
  private readonly active = new Set<Track>();
  private readonly playRequests = new Map<Track, object>();
  private entered = false;
  private suspended = false;
  private disposed = false;

  constructor(baseUrl = `${import.meta.env?.BASE_URL ?? '/'}audio/mixed/`) {
    for (const [key, file] of Object.entries(tracks) as [Track, string][]) {
      const audio = new Audio(`${baseUrl}${file}`);
      audio.loop = key === 'environment' || key === 'drag';
      audio.preload = 'auto';
      this.audio.set(key, audio);
    }
  }

  /** 浏览器后台预加载；不等待 canplaythrough，以免网络异常阻塞舞台初始化。 */
  preload(): void {
    if (!this.disposed) for (const audio of this.audio.values()) audio.load();
  }

  enterScene(): void {
    if (this.disposed || this.entered) return;
    this.entered = true;
    this.play('enter', () => this.play('environment'));
  }

  grab(): void {
    if (!this.canInteract()) return;
    this.stopFeedback();
    this.play('grab');
    this.play('drag');
  }

  stopDragging(): void { this.stop('drag'); }

  catchBottle(): void {
    if (!this.canInteract()) return;
    this.stopDragging();
    this.stopFeedback();
    // 用 ended 串联，不依赖标称的 0.6 秒时长；停止时会撤销这个回调。
    this.play('catch', () => this.play('success'));
  }

  returnBottle(): void {
    this.stopDragging();
    this.stopFeedback();
    if (this.canInteract()) this.play('return');
  }

  /** 状态机同步通知，鼠标/手势/辅助操作共用；不会漏掉同一帧内的松手。 */
  onHandoffState(state: HandoffState, previous: HandoffState): void {
    if (previous === 'dragging' && state !== 'dragging') this.stopDragging();
    if (state === 'dragging') this.grab();
    else if (state === 'snapped') this.catchBottle();
    else if (state === 'returning') this.returnBottle();
    else if (state === 'completing' && previous !== 'snapped') this.catchBottle();
  }

  /** 隐藏页面/退出全屏：短音效归零，背景及入场保留进度。 */
  pause(): void {
    this.suspended = true;
    this.stopDragging();
    this.stopFeedback();
    for (const key of this.active) {
      this.playRequests.delete(key);
      this.audio.get(key)!.pause();
    }
  }

  resume(): void {
    if (this.disposed || !this.suspended) return;
    this.suspended = false;
    for (const key of this.active) this.tryPlay(key);
  }

  stopAllAudio(): void {
    for (const key of this.audio.keys()) this.stop(key);
    this.entered = false;
    this.suspended = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.stopAllAudio();
    this.disposed = true;
    for (const audio of this.audio.values()) {
      audio.removeAttribute('src');
      audio.load();
    }
    this.audio.clear();
  }

  private canInteract(): boolean { return this.entered && !this.suspended && !this.disposed; }

  private stopFeedback(): void {
    for (const key of ['grab', 'catch', 'return', 'success'] as const) this.stop(key);
  }

  private stop(key: Track): void {
    this.pending.get(key)?.();
    this.pending.delete(key);
    this.active.delete(key);
    this.playRequests.delete(key);
    const audio = this.audio.get(key);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  private play(key: Track, onEnded?: () => void): void {
    if (this.disposed || !this.entered) return;
    this.stop(key);
    const audio = this.audio.get(key)!;
    const cleanup = (): void => {
      audio.removeEventListener('ended', ended);
      audio.removeEventListener('error', failed);
    };
    const ended = (): void => {
      if (this.pending.get(key) !== cleanup) return;
      this.stop(key);
      onEnded?.();
    };
    const failed = (): void => {
      if (this.pending.get(key) !== cleanup) return;
      console.warn(`音效加载失败：${tracks[key]}`, audio.error);
      ended(); // 入场或 catch 文件损坏时，仍尝试下一条音轨。
    };
    this.pending.set(key, cleanup);
    this.active.add(key);
    audio.addEventListener('ended', ended);
    audio.addEventListener('error', failed);
    if (!this.suspended) this.tryPlay(key);
  }

  private tryPlay(key: Track): void {
    const token = this.pending.get(key);
    const audio = this.audio.get(key)!;
    const request = {};
    this.playRequests.set(key, request);
    void audio.play().catch((error: unknown) => {
      // pause/stop 引起的 AbortError 或旧播放请求的迟到拒绝，不影响后续音效。
      if (this.pending.get(key) !== token || this.playRequests.get(key) !== request || this.suspended) return;
      console.warn(`音效播放失败：${tracks[key]}`, error);
      this.stop(key);
      if (key === 'enter') this.play('environment');
    });
  }
}
