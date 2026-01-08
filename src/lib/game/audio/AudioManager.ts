type PlayOptions = {
  loop?: boolean;
  fadeInMs?: number;
  crossfadeMs?: number;
};

type StopOptions = {
  fadeOutMs?: number;
};

export class AudioManager {
  private bgm: HTMLAudioElement | null = null;
  private bgmPath: string | null = null;
  private bgmVolume = 1;
  private fadeTimers = new Map<HTMLAudioElement, number>();

  async playBgm(path: string, options: PlayOptions = {}) {
    const loop = options.loop ?? true;
    const fadeInMs = options.fadeInMs ?? 0;
    const crossfadeMs = options.crossfadeMs ?? 0;

    if (!path) {
      return;
    }

    if (this.bgm && this.bgmPath === path) {
      if (this.bgm.paused) {
        try {
          await this.bgm.play();
        } catch {
          // Ignore autoplay errors.
        }
      }
      return;
    }

    if (this.bgm && crossfadeMs > 0) {
      await this.crossfadeBgm(path, { durationMs: crossfadeMs, loop });
      return;
    }

    const audio = this.createAudio(path, loop);
    this.bgm = audio;
    this.bgmPath = path;

    if (fadeInMs > 0) {
      audio.volume = 0;
    } else {
      audio.volume = this.bgmVolume;
    }

    try {
      await audio.play();
    } catch {
      // Ignore autoplay errors.
    }

    if (fadeInMs > 0) {
      this.fadeVolume(audio, this.bgmVolume, fadeInMs);
    }
  }

  async crossfadeBgm(
    path: string,
    options: { durationMs?: number; loop?: boolean } = {},
  ) {
    const loop = options.loop ?? true;
    const durationMs = options.durationMs ?? 500;

    if (!path) {
      return;
    }

    if (this.bgm && this.bgmPath === path) {
      return;
    }

    const next = this.createAudio(path, loop);
    next.volume = 0;

    try {
      await next.play();
    } catch {
      // Ignore autoplay errors.
    }

    const previous = this.bgm;
    this.bgm = next;
    this.bgmPath = path;

    this.fadeVolume(next, this.bgmVolume, durationMs);
    if (previous) {
      this.fadeVolume(previous, 0, durationMs, () => {
        previous.pause();
        previous.currentTime = 0;
      });
    }
  }

  stopBgm(options: StopOptions = {}) {
    if (!this.bgm) {
      return;
    }

    const fadeOutMs = options.fadeOutMs ?? 0;
    const current = this.bgm;

    if (fadeOutMs > 0) {
      this.fadeVolume(current, 0, fadeOutMs, () => {
        current.pause();
        current.currentTime = 0;
      });
      return;
    }

    current.pause();
    current.currentTime = 0;
  }

  setBgmVolume(volume: number) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgm) {
      this.bgm.volume = this.bgmVolume;
    }
  }

  private createAudio(path: string, loop: boolean) {
    const audio = new Audio(path);
    audio.loop = loop;
    audio.preload = "auto";
    return audio;
  }

  private fadeVolume(
    audio: HTMLAudioElement,
    targetVolume: number,
    durationMs: number,
    onComplete?: () => void,
  ) {
    this.clearFade(audio);
    const startVolume = audio.volume;
    const delta = targetVolume - startVolume;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      audio.volume = startVolume + delta * progress;
      if (progress >= 1) {
        this.clearFade(audio);
        if (onComplete) {
          onComplete();
        }
        return;
      }
      const id = window.requestAnimationFrame(tick);
      this.fadeTimers.set(audio, id);
    };

    const id = window.requestAnimationFrame(tick);
    this.fadeTimers.set(audio, id);
  }

  private clearFade(audio: HTMLAudioElement) {
    const id = this.fadeTimers.get(audio);
    if (id !== undefined) {
      window.cancelAnimationFrame(id);
      this.fadeTimers.delete(audio);
    }
  }
}

export const audioManager = new AudioManager();
