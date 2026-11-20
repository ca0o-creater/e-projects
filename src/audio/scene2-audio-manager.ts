import { ManagedAudioBank } from './managed-audio-bank.ts';
import type { SwallowSnapshot } from '../interaction/swallow.ts';

export const scene2AudioTracks = {
  // 原素材：入场均值 -41 dB、逢蒙进场段 -48.3 dB；播放增益不改 WAV。
  intro: { url: '/audio/scene2-intro.wav', gainDb: 20, compress: true },
  // 庭院原素材均值 -58.1 dB，提升后约 -32.1 dB，仍保持背景层级。
  courtyard: { url: '/audio/scene2-courtyard-loop.wav', loop: true, gainDb: 26 },
  // 按原文件实测电平分别补偿；短反馈峰值保持余量，剧情峰值另做动态压缩。
  grab: { url: '/audio/scene2-grab-wrist.wav', gainDb: 26, compress: true },
  lift: { url: '/audio/scene2-arm-lift-loop.wav', loop: true, gainDb: 24, compress: true },
  charge: { url: '/audio/scene2-target-charge.wav', gainDb: 32, compress: true },
  return: { url: '/audio/scene2-arm-return.wav', gainDb: 22, compress: true },
  // 原均值 -50 dB；覆盖 1.3 秒吞药 + 3 秒自动升起，沿用原文件与时序。
  swallow: { url: '/audio/scene2-swallow-rise.wav', gainDb: 30, compress: true },
} as const;

export class Scene2AudioManager {
  private readonly bank = new ManagedAudioBank(scene2AudioTracks);
  private started = false;
  private paused = false;
  private disposed = false;
  private storyPlaying = false;

  preload(): void { this.bank.preload(); }

  start(options: { skipIntro?: boolean; staticPreview?: boolean } = {}): void {
    if (this.started || this.disposed || options.staticPreview) return;
    this.started = true;
    const environment = (): void => this.bank.play('courtyard');
    if (options.skipIntro) environment();
    else this.bank.play('intro', environment, environment);
  }

  onState(next: SwallowSnapshot, previous: SwallowSnapshot): void {
    if (next.state === 'disposed') { this.dispose(); return; }
    if (!this.started || this.paused || this.disposed) return;
    if (next.state === 'returning' && previous.state !== 'returning') {
      this.bank.setVolume('courtyard', 0.5);
      this.stopFeedback();
      this.bank.play('return');
    } else if (next.state === 'swallowing' && previous.state === 'armed') {
      this.stopFeedback();
      this.storyPlaying = true;
      this.bank.setVolume('courtyard', 0.35);
      const restoreEnvironment = (): void => {
        this.storyPlaying = false;
        this.bank.setVolume('courtyard', 1);
      };
      this.bank.play('swallow', restoreEnvironment, restoreEnvironment);
    } else if (next.state === 'dragging' || next.state === 'armed') {
      this.bank.setVolume('courtyard', 0.5);
      if (previous.state === 'ready') {
        this.stopFeedback();
        this.bank.play('grab');
        if (!next.inTarget) this.bank.play('lift');
      }
      if (next.inTarget && (!previous.inTarget || previous.state === 'ready')) {
        this.bank.stop('lift');
        this.bank.play('charge');
      } else if (!next.inTarget && previous.inTarget && next.state === 'dragging') {
        this.bank.stop('charge');
        this.bank.play('lift');
      }
      if (next.state === 'armed') this.bank.stop('lift');
    } else if (next.state === 'ready') {
      this.bank.setVolume('courtyard', 1);
    }
  }

  pause(): void {
    this.paused = true;
    this.stopFeedback();
    if (!this.storyPlaying) this.bank.setVolume('courtyard', 1);
    this.bank.pause();
  }
  resume(): void { this.paused = false; this.bank.resume(); }
  retryBlocked(): void { this.bank.retryBlocked(); }
  stopAllAudio(): void {
    this.bank.stopAllAudio();
    this.bank.setVolume('courtyard', 1);
    this.storyPlaying = false;
    this.started = false;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.bank.dispose();
  }
  private stopFeedback(): void {
    for (const key of ['grab', 'lift', 'charge', 'return'] as const) this.bank.stop(key);
  }
}
