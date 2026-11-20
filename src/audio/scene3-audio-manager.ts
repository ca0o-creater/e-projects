import { ManagedAudioBank } from './managed-audio-bank.ts';
import type { AscentSnapshot, AscentChangeReason } from '../interaction/ascent.ts';

// 原始 RMS / peak(dBFS)：sky -39.7/-24.7，grab -42.5/-20.5，ascent -34.5/-16.7，
// charge -49.5/-37.2，pause -89.6/-76.3，entry -37.1/-20.5。仅播放增益，不改 WAV。
export const scene3AudioTracks = {
  sky: { url: '/audio/scene3-moon-sky-loop.wav', loop: true, gainDb: 3 },
  grab: { url: '/audio/scene3-grab-rod.wav', gainDb: 12, compress: true },
  ascent: { url: '/audio/scene3-ascent-loop.wav', loop: true, gainDb: 6, compress: true },
  charge: { url: '/audio/scene3-target-charge.wav', gainDb: 24, compress: true },
  pause: { url: '/audio/scene3-ascent-pause.wav', gainDb: 60, compress: true },
  entry: { url: '/audio/scene3-moon-entry.wav', gainDb: 16, compress: true },
} as const;

export class Scene3AudioManager {
  private readonly bank = new ManagedAudioBank(scene3AudioTracks);
  private started = false;
  private paused = false;
  private disposed = false;
  private environmentStarted = false;
  private state: AscentSnapshot['state'] = 'intro';

  preload(): void { this.bank.preload(); }

  start(snapshot: AscentSnapshot, options: { staticPreview?: boolean } = {}): void {
    if (this.started || this.disposed || options.staticPreview) return;
    this.started = true;
    this.state = snapshot.state;
    if (!['intro', 'complete', 'disposed'].includes(snapshot.state)) this.startEnvironment();
  }

  onState(next: AscentSnapshot, previous: AscentSnapshot, reason: AscentChangeReason = 'interaction'): void {
    if (next.state === 'disposed') { this.dispose(); return; }
    this.state = next.state;
    if (!this.started || this.disposed) return;
    if (next.state === 'complete') {
      this.stopFeedback();
      this.bank.stop('sky');
      // 入月尾音允许自然结束；视频首帧回调有最终停声屏障。
      return;
    }
    if (this.paused) return;
    if (previous.state === 'intro' && next.state === 'ready') this.startEnvironment();
    if (next.state === 'ending' && previous.state !== 'ending') {
      this.stopFeedback();
      this.bank.setVolume('sky', 0.25);
      this.bank.play('entry');
      return;
    }
    const wasMoving = previous.assisting || previous.state === 'dragging' || previous.state === 'armed';
    const moving = next.assisting || next.state === 'dragging' || next.state === 'armed';
    if (next.state === 'ready' && !next.assisting && wasMoving) {
      this.stopFeedback();
      this.bank.setVolume('sky', 1);
      if (reason !== 'cancel') this.bank.play('pause');
      return;
    }
    if (!moving) return;
    this.bank.setVolume('sky', 0.5);
    if (!wasMoving) {
      this.stopFeedback();
      if (!next.assisting) this.bank.play('grab');
      this.bank.play('ascent');
    }
    if (next.charging && !previous.charging) {
      this.bank.stop('ascent');
      this.bank.play('charge');
    } else if (!next.charging && previous.charging) {
      this.bank.stop('charge');
      this.bank.play('ascent');
    }
    if (next.state === 'armed') this.bank.stop('ascent');
  }

  pause(): void {
    this.paused = true;
    this.stopFeedback();
    if (this.state !== 'ending') this.bank.setVolume('sky', 1);
    this.bank.pause();
  }
  resume(): void { this.paused = false; this.bank.resume(); }
  retryBlocked(): void { if (this.started) this.bank.retryBlocked(); }
  /** 视频开始显示、重演或离场后禁止迟到通知重新启动音频。 */
  stopAllAudio(): void {
    this.started = false;
    this.environmentStarted = false;
    this.bank.stopAllAudio();
    this.bank.setVolume('sky', 1);
  }
  dispose(): void {
    if (this.disposed) return;
    this.stopAllAudio(); this.disposed = true; this.bank.dispose();
  }
  private startEnvironment(): void {
    if (this.environmentStarted) return;
    this.environmentStarted = true;
    this.bank.play('sky');
  }
  private stopFeedback(): void {
    for (const key of ['grab', 'ascent', 'charge', 'pause'] as const) this.bank.stop(key);
  }
}
