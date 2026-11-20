export interface AudioTrack {
  url: string;
  loop?: boolean;
  /** HTMLMediaElement.volume 最大为 1，正增益需要 Web Audio。 */
  gainDb?: number;
  compress?: boolean | {
    threshold?: number; knee?: number; ratio?: number; attack?: number; release?: number;
  };
  /** 明确允许跨场景单次音效在自动播放受限后由用户操作重试。 */
  retryOnBlocked?: boolean;
}
interface Playback {
  cleanup: () => void;
  finish: (failed?: boolean) => void;
  request?: object;
  deferredEnd?: boolean;
  deferredFailure?: boolean;
  blocked?: boolean;
  pending?: boolean;
  retryExpired?: boolean;
}

/** 可取消的媒体播放基础层；状态和目标圈逻辑由各场景管理器提供。 */
export class ManagedAudioBank<Key extends string> {
  private readonly elements = new Map<Key, HTMLAudioElement>();
  private readonly playing = new Map<Key, Playback>();
  private paused = false;
  private disposed = false;
  private readonly tracks: Record<Key, AudioTrack>;
  private context: AudioContext | undefined;
  private readonly routes = new Map<Key, AudioNode[]>();

  constructor(tracks: Record<Key, AudioTrack>) {
    this.tracks = tracks;
    for (const key of Object.keys(tracks) as Key[]) {
      const audio = new Audio(tracks[key].url);
      audio.loop = tracks[key].loop ?? false;
      audio.preload = 'auto';
      this.elements.set(key, audio);
    }
  }

  preload(): void {
    if (!this.disposed) for (const audio of this.elements.values()) audio.load();
  }

  play(key: Key, onEnded?: () => void, onError?: () => void): void {
    if (this.disposed) return;
    this.stop(key);
    const audio = this.elements.get(key);
    if (!audio) return;
    const playback: Playback = {
      cleanup: () => {
        audio.removeEventListener('ended', ended);
        audio.removeEventListener('error', failed);
      },
      finish: (failure = false) => {
        if (this.playing.get(key) !== playback) return;
        if (this.paused) {
          playback.deferredEnd = true;
          playback.deferredFailure = failure;
          return;
        }
        this.stop(key);
        (failure ? onError : onEnded)?.();
      },
    };
    const ended = (): void => playback.finish();
    const failed = (): void => playback.finish(true);
    this.playing.set(key, playback);
    audio.addEventListener('ended', ended);
    audio.addEventListener('error', failed);
    if (audio.error) failed();
    else if (!this.paused) this.requestPlay(key, playback);
  }

  stop(key: Key): void {
    this.playing.get(key)?.cleanup();
    this.playing.delete(key);
    const audio = this.elements.get(key);
    if (audio) { audio.pause(); audio.currentTime = 0; }
  }

  stopAllAudio(): void { for (const key of this.elements.keys()) this.stop(key); }

  /** 收回当前单次播放的重试资格，已在播放的声音仍可自然结束。 */
  disableRetry(key: Key): void {
    const playback = this.playing.get(key);
    if (!playback) return;
    playback.retryExpired = true;
    if (playback.blocked) this.stop(key);
  }

  /** 永久释放不再使用的单条音轨，其他音轨的路由不受影响。 */
  release(key: Key): void {
    this.stop(key);
    const audio = this.elements.get(key);
    if (audio) { audio.removeAttribute('src'); audio.load(); }
    this.elements.delete(key);
    for (const node of this.routes.get(key) ?? []) node.disconnect();
    this.routes.delete(key);
  }

  /** 背景避让：只调整混音比例，不重启或改变媒体播放进度。 */
  setVolume(key: Key, volume: number): void {
    const audio = this.elements.get(key);
    if (audio && Number.isFinite(volume)) audio.volume = Math.max(0, Math.min(1, volume));
  }

  /** 仅校正仍有效的播放，不复活已经结束/失败的音轨。用于视频恢复或权限重试。 */
  alignPosition(key: Key, seconds: number, tolerance = 0.08): void {
    const audio = this.elements.get(key);
    if (!audio || !this.playing.has(key) || !Number.isFinite(seconds)) return;
    if (Math.abs(audio.currentTime - seconds) > tolerance) {
      try { audio.currentTime = Math.max(0, seconds); } catch { /* 尚无可寻址媒体数据。 */ }
    }
  }

  pause(): void {
    if (this.disposed || this.paused) return;
    this.paused = true;
    for (const [key, playback] of this.playing) {
      playback.request = undefined;
      playback.pending = false;
      this.elements.get(key)!.pause();
    }
  }

  resume(): void {
    if (this.disposed) return;
    this.paused = false;
    for (const [key, playback] of [...this.playing]) {
      if (playback.deferredEnd) playback.finish(playback.deferredFailure);
      else if (this.elements.get(key)!.paused && !playback.pending) this.requestPlay(key, playback);
    }
  }

  /** 自动播放受限后，在下一次真实点击/按键中重试；不重播已结束的短音效。 */
  retryBlocked(): void {
    if (this.disposed || this.paused) return;
    this.resumeContext();
    for (const [key, playback] of this.playing) {
      if (playback.blocked && !playback.pending) this.requestPlay(key, playback);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.stopAllAudio();
    this.disposed = true;
    for (const audio of this.elements.values()) {
      audio.removeAttribute('src');
      audio.load();
    }
    this.elements.clear();
    for (const nodes of this.routes.values()) for (const node of nodes) node.disconnect();
    this.routes.clear();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.context = undefined;
  }

  private resumeContext(): void {
    if (this.context?.state === 'suspended') void this.context.resume().catch(() => {});
  }

  private routeAudio(key: Key): void {
    const track = this.tracks[key];
    if (track.gainDb === undefined || typeof AudioContext === 'undefined') return;
    if (!this.routes.has(key)) {
      const context = this.context ??= new AudioContext();
      const source = context.createMediaElementSource(this.elements.get(key)!);
      const gain = context.createGain();
      gain.gain.value = 10 ** (track.gainDb / 20);
      source.connect(gain);
      const nodes: AudioNode[] = [source, gain];
      if (track.compress) {
        // 抬高安静的脚步/氛围细节，同时压住入场音中的突发峰值。
        const compressor = context.createDynamicsCompressor();
        const settings = typeof track.compress === 'object' ? track.compress : {};
        compressor.threshold.value = settings.threshold ?? -6;
        compressor.knee.value = settings.knee ?? 6;
        compressor.ratio.value = settings.ratio ?? 12;
        compressor.attack.value = settings.attack ?? 0.003;
        compressor.release.value = settings.release ?? 0.12;
        gain.connect(compressor);
        compressor.connect(context.destination);
        nodes.push(compressor);
      } else gain.connect(context.destination);
      this.routes.set(key, nodes);
    }
    this.resumeContext();
  }

  private requestPlay(key: Key, playback: Playback): void {
    const request = {};
    playback.request = request;
    playback.pending = true;
    playback.blocked = false;
    const current = (): boolean => !this.disposed && !this.paused
      && this.playing.get(key) === playback && playback.request === request;
    const failed = (error: unknown): void => {
      if (!current()) return;
      playback.pending = false;
      if (error instanceof Error && error.name === 'NotAllowedError'
        && !playback.retryExpired && (this.elements.get(key)!.loop || this.tracks[key].retryOnBlocked)) {
        playback.blocked = true;
        return;
      }
      playback.finish(true);
    };
    try {
      this.routeAudio(key);
      void this.elements.get(key)!.play().then(() => {
        if (current()) playback.pending = false;
      }, failed);
    } catch (error) { failed(error); }
  }
}
