import { ManagedAudioBank } from './managed-audio-bank.ts';

/** 页面拥有，独立于第一幕的 SceneLifetime；第二幕离场时显式停止。 */
export class MortalTransition {
  private readonly bank = new ManagedAudioBank({ transition: { url: '/audio/transition-to-mortal.wav' } });
  private navigating = false;
  preload(): void { this.bank.preload(); }
  navigate(canNavigate: () => boolean, mount: () => void): boolean {
    if (this.navigating || !canNavigate()) return false;
    this.navigating = true;
    try {
      this.bank.play('transition');
      mount(); // 不等待音效结束；同步换场后 canNavigate 必须返回 false。
      return true;
    } finally { this.navigating = false; }
  }
  pause(): void { this.bank.pause(); }
  resume(): void { this.bank.resume(); }
  stopAllAudio(): void { this.bank.stopAllAudio(); }
  dispose(): void { this.bank.dispose(); }
}
