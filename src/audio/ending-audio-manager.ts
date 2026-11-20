import { ManagedAudioBank, type AudioTrack } from './managed-audio-bank.ts';

export const endingAudioTracks = {
  moon: { url: '/audio/ending-moon-response.wav', loop: false, gainDb: 0, retryOnBlocked: true },
  cry: {
    url: '/audio/ending-change-cry.wav', loop: false, gainDb: 7, retryOnBlocked: true,
    compress: { threshold: -6, knee: 6, ratio: 3, attack: 0.01, release: 0.18 },
  },
  // 原始 peak -7.6 dBFS；+2.5 dB 后仍留 5.1 dB 余量，不压缩自然停顿和尾音。
  caption: { url: '/audio/ending-caption-voice.wav', loop: false, gainDb: 2.5, retryOnBlocked: true },
} satisfies Record<string, AudioTrack>;

/** 一次 EndingFilm 拥有一个实例。以视频显示时间同步，绝不改变 WAV 播放速度。 */
export class EndingAudioManager {
  private readonly bank = new ManagedAudioBank(endingAudioTracks);
  private started = false;
  private active = false;
  private paused = false;
  private disposed = false;
  private captionStarted = false;
  private captionActive = false;
  private captionRetryAllowed = false;

  constructor() {
    // 月光留在哭声之后；与 +7 dB 哭声叠加仍保留峰值余量。
    this.bank.setVolume('moon', 0.6);
  }

  preload(): void { this.bank.preload(); }

  start(): void {
    if (this.disposed || this.started || this.captionStarted) return;
    this.started = this.active = true;
    this.bank.play('moon');
    this.bank.play('cry');
  }

  playCaption(): void {
    if (this.disposed || this.captionStarted) return;
    this.stopVideoAudio();
    this.captionStarted = this.captionActive = this.captionRetryAllowed = true;
    const finished = (): void => { this.captionActive = this.captionRetryAllowed = false; };
    this.bank.play('caption', finished, finished);
  }

  /** 由字幕的可暂停显示时间窗口决定何时禁止迟到补播，不截断正常尾音。 */
  expireCaptionRetry(): void {
    this.captionRetryAllowed = false;
    this.bank.disableRetry('caption');
  }

  stopVideoAudio(): void {
    this.started = true;
    this.active = false;
    this.bank.stop('moon');
    this.bank.stop('cry');
  }

  stopCaption(): void {
    this.captionStarted = true;
    this.captionActive = this.captionRetryAllowed = false;
    this.bank.release('caption');
  }

  pause(): void {
    if (this.disposed || this.paused) return;
    this.paused = true;
    this.bank.pause();
  }

  resume(displayTime?: number): void {
    if (this.disposed || !this.paused) return;
    if (this.active) this.align(displayTime);
    this.paused = false;
    this.bank.resume();
  }

  retryBlocked(displayTime?: number): void {
    if (this.disposed || this.paused) return;
    if (this.captionStarted) {
      if (!this.captionActive || !this.captionRetryAllowed) return;
    } else if (this.active) this.align(displayTime);
    else return;
    this.bank.retryBlocked();
  }

  private align(displayTime?: number): void {
    if (displayTime === undefined || !Number.isFinite(displayTime)) return;
    for (const [key, duration] of [['moon', 1.2], ['cry', 4]] as const) {
      if (displayTime >= duration) this.bank.stop(key);
      else this.bank.alignPosition(key, displayTime);
    }
  }

  stopAllAudio(): void {
    this.started = this.captionStarted = true;
    this.active = false;
    this.captionActive = this.captionRetryAllowed = false;
    this.bank.stopAllAudio();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = false;
    this.captionActive = this.captionRetryAllowed = false;
    this.bank.dispose();
  }
}
