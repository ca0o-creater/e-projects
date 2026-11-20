import { ManagedAudioBank } from './managed-audio-bank.ts';

/** 页面级所有权：第二幕销毁不影响声音；第三幕离场或应用销毁时清理。 */
export class MoonTransition {
  private readonly bank = new ManagedAudioBank({
    transition: { url: '/audio/transition-to-moon.wav', retryOnBlocked: true },
  });
  private navigating = false;
  private disposed = false;
  private generation = 0;

  preload(): void { this.bank.preload(); }

  navigate(canNavigate: () => boolean, mount: () => void): boolean {
    if (this.disposed || this.navigating || !canNavigate()) return false;
    this.navigating = true;
    const generation = ++this.generation;
    // 必须在点击调用栈内调用 play；只有销毁和挂载放到微任务，不能等待 ended。
    this.bank.play('transition');
    queueMicrotask(() => {
      if (this.disposed || generation !== this.generation) return;
      try {
        if (!canNavigate()) { this.bank.stopAllAudio(); return; }
        mount();
      } catch (error) {
        this.bank.stopAllAudio();
        throw error;
      } finally { this.navigating = false; }
    });
    return true;
  }

  pause(): void { this.bank.pause(); }
  resume(): void { this.bank.resume(); }
  retryBlocked(): void { this.bank.retryBlocked(); }
  stopAllAudio(): void {
    this.generation++;
    this.navigating = false;
    this.bank.stopAllAudio();
  }
  dispose(): void {
    if (this.disposed) return;
    this.stopAllAudio();
    this.disposed = true;
    this.bank.dispose();
  }
}
