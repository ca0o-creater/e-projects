import type { AudioManager } from './audio-manager.ts';

export type PrologueTrack = 'intro' | 'journey';
export type PrologueAudioState =
  | 'idle' | 'intro' | 'intro-gap' | 'journey' | 'journey-gap' | 'complete' | 'disposed';

export interface PrologueAudioCallbacks {
  showIntro: () => void;
  showJourney: () => void;
  beginEnding: () => void;
  complete: () => void;
  playbackError?: (error: unknown, track: PrologueTrack) => void;
}

interface PrologueAudioTiming {
  introGapMs: number;
  endingGapMs: number;
}

/** 只负责序章两条音轨与留白；具体画面状态由 callbacks 修改。 */
export class PrologueAudioFlow {
  state: PrologueAudioState = 'idle';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private runId = 0;
  private paused = false;
  private gapRemaining = 0;
  private gapStartedAt = 0;
  private gapCallback: (() => void) | undefined;
  private readonly audio: AudioManager<PrologueTrack>;
  private readonly timing: PrologueAudioTiming;
  private readonly callbacks: PrologueAudioCallbacks;

  constructor(
    audio: AudioManager<PrologueTrack>,
    timing: PrologueAudioTiming,
    callbacks: PrologueAudioCallbacks,
  ) { this.audio = audio; this.timing = timing; this.callbacks = callbacks; }

  start(): void {
    if (this.state === 'disposed') return;
    this.cancelPending();
    const runId = this.runId;
    this.state = 'intro';
    this.callbacks.showIntro();
    void this.audio.play('intro', () => this.finishIntro(runId))
      .catch((error: unknown) => this.recoverFromPlaybackError(error, 'intro', runId));
  }

  pause(): void {
    if (this.state === 'disposed' || this.paused) return;
    this.paused = true;
    this.audio.pause();
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.gapRemaining = Math.max(0, this.gapRemaining - (performance.now() - this.gapStartedAt));
    }
  }

  async resume(): Promise<void> {
    if (this.state === 'disposed') return;
    this.paused = false;
    this.armGap();
    if (this.state !== 'intro' && this.state !== 'journey') return;
    const state = this.state;
    const runId = this.runId;
    try {
      await this.audio.resume();
    } catch (error) {
      this.recoverFromPlaybackError(error, state, runId);
    }
  }

  /** 跳过必须同步停声、清定时器，再进入第一幕。 */
  skip(): void {
    if (this.state === 'disposed' || this.state === 'complete') return;
    this.cancelPending();
    this.state = 'complete';
    this.callbacks.complete();
  }

  /** 全屏进入失败时回到序章起点，但不进入第一幕。 */
  reset(): void {
    if (this.state === 'disposed') return;
    this.cancelPending();
    this.state = 'idle';
    this.callbacks.showIntro();
  }

  dispose(): void {
    if (this.state === 'disposed') return;
    this.cancelPending();
    this.state = 'disposed';
  }

  private finishIntro(runId: number): void {
    if (!this.isCurrent(runId, 'intro')) return;
    this.state = 'intro-gap';
    this.waitGap(this.timing.introGapMs, () => {
      if (!this.isCurrent(runId, 'intro-gap')) return;
      this.timer = undefined;
      this.state = 'journey';
      this.callbacks.showJourney();
      void this.audio.play('journey', () => this.finishJourney(runId))
        .catch((error: unknown) => this.recoverFromPlaybackError(error, 'journey', runId));
    });
  }

  private finishJourney(runId: number): void {
    if (!this.isCurrent(runId, 'journey')) return;
    this.state = 'journey-gap';
    this.callbacks.beginEnding();
    this.waitGap(this.timing.endingGapMs, () => {
      if (!this.isCurrent(runId, 'journey-gap')) return;
      this.timer = undefined;
      this.state = 'complete';
      this.callbacks.complete();
    });
  }

  private waitGap(ms: number, callback: () => void): void {
    this.gapRemaining = ms;
    this.gapCallback = callback;
    this.armGap();
  }

  private armGap(): void {
    if (this.paused || !this.gapCallback || this.timer !== undefined) return;
    this.gapStartedAt = performance.now();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const callback = this.gapCallback;
      this.gapCallback = undefined;
      callback?.();
    }, this.gapRemaining);
  }

  private recoverFromPlaybackError(error: unknown, track: PrologueTrack, runId: number): void {
    const expected = track === 'intro' ? 'intro' : 'journey';
    if (!this.isCurrent(runId, expected)) return;
    this.callbacks.playbackError?.(error, track);
    // 音频缺失或被浏览器拦截时仍继续流程，避免用户卡死在序章。
    if (track === 'intro') this.finishIntro(runId);
    else this.finishJourney(runId);
  }

  private cancelPending(): void {
    this.runId += 1;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.gapCallback = undefined;
    this.gapRemaining = 0;
    this.paused = false;
    this.audio.stop();
  }

  private isCurrent(runId: number, state: PrologueAudioState): boolean {
    return this.runId === runId && this.state === state;
  }
}
