export type AudioSources<Track extends string> = Readonly<Record<Track, string>>;

interface ActiveAudio<Track extends string> {
  track: Track;
  audio: HTMLAudioElement;
  ended: () => void;
  playbackId: number;
}

/**
 * 页面级的轻量音频管理器。
 * 同一时刻最多允许一条音轨播放；stop/destroy 会同步撤销 ended 与淡出任务。
 */
export class AudioManager<Track extends string> {
  private readonly audios = new Map<Track, HTMLAudioElement>();
  private active: ActiveAudio<Track> | undefined;
  private playbackId = 0;
  private fadeFrame: number | undefined;
  private finishFade: (() => void) | undefined;
  private destroyed = false;
  private playRequest = 0;
  private readonly preloads = new Set<() => void>();

  constructor(sources: AudioSources<Track>) {
    for (const [track, source] of Object.entries(sources) as [Track, string][]) {
      const audio = new Audio(source);
      audio.preload = 'auto';
      this.audios.set(track, audio);
    }
  }

  preload(track: Track): Promise<void> {
    const audio = this.getAudio(track);
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timeout);
        this.preloads.delete(cancel);
        audio.removeEventListener('canplaythrough', ready);
        audio.removeEventListener('error', failed);
      };
      const ready = (): void => { cleanup(); resolve(); };
      const failed = (): void => {
        cleanup();
        reject(new Error(`音频预加载失败：${audio.currentSrc || audio.src}`));
      };
      const cancel = (): void => { cleanup(); resolve(); };
      const timeout = setTimeout(failed, 8000);
      this.preloads.add(cancel);
      audio.addEventListener('canplaythrough', ready);
      audio.addEventListener('error', failed);
      audio.load();
    });
  }

  async preloadAll(): Promise<void> {
    await Promise.all([...this.audios.keys()].map((track) => this.preload(track)));
  }

  async play(track: Track, onEnded?: () => void): Promise<void> {
    this.assertUsable();
    this.stop();

    const audio = this.getAudio(track);
    const playbackId = ++this.playbackId;
    audio.currentTime = 0;
    audio.volume = 1;
    const ended = (): void => {
      if (this.active?.playbackId !== playbackId) return;
      audio.removeEventListener('ended', ended);
      this.active = undefined;
      onEnded?.();
    };
    audio.addEventListener('ended', ended);
    this.active = { track, audio, ended, playbackId };
    const request = ++this.playRequest;

    try {
      await audio.play();
    } catch (error) {
      if (request !== this.playRequest) return;
      if (this.active?.playbackId === playbackId) {
        audio.removeEventListener('ended', ended);
        this.active = undefined;
      }
      throw error;
    }
  }

  pause(): void {
    this.playRequest += 1;
    this.active?.audio.pause();
  }

  async resume(): Promise<void> {
    this.assertUsable();
    const request = ++this.playRequest;
    if (this.active?.audio.paused) {
      try { await this.active.audio.play(); }
      catch (error) { if (request === this.playRequest) throw error; }
    }
  }

  stop(): void {
    this.playRequest += 1;
    this.playbackId += 1;
    this.cancelFade();
    if (this.active) {
      this.active.audio.removeEventListener('ended', this.active.ended);
      this.active = undefined;
    }
    // 即使外部代码曾意外触发某个 audio，也全部停掉，杜绝叠播。
    for (const audio of this.audios.values()) {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
    }
  }

  fadeOut(durationMs = 500): Promise<void> {
    const active = this.active;
    if (!active || durationMs <= 0) {
      this.stop();
      return Promise.resolve();
    }

    this.cancelFade();
    const startedAt = performance.now();
    const startVolume = active.audio.volume;
    return new Promise<void>((resolve) => {
      this.finishFade = resolve;
      const tick = (now: number): void => {
        if (this.active?.playbackId !== active.playbackId) {
          this.cancelFade();
          return;
        }
        const progress = Math.min(1, (now - startedAt) / durationMs);
        active.audio.volume = startVolume * (1 - progress);
        if (progress < 1) {
          this.fadeFrame = requestAnimationFrame(tick);
          return;
        }
        this.fadeFrame = undefined;
        this.finishFade = undefined;
        this.stop();
        resolve();
      };
      this.fadeFrame = requestAnimationFrame(tick);
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.stop();
    this.destroyed = true;
    for (const cancel of this.preloads) cancel();
    for (const audio of this.audios.values()) {
      audio.removeAttribute('src');
      audio.load();
    }
    this.audios.clear();
  }

  private cancelFade(): void {
    if (this.fadeFrame !== undefined) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = undefined;
    const resolve = this.finishFade;
    this.finishFade = undefined;
    resolve?.();
  }

  private getAudio(track: Track): HTMLAudioElement {
    this.assertUsable();
    const audio = this.audios.get(track);
    if (!audio) throw new Error(`未注册音轨：${track}`);
    return audio;
  }

  private assertUsable(): void {
    if (this.destroyed) throw new Error('AudioManager 已销毁');
  }
}
