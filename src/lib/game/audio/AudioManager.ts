type PlayOptions = {
  loop?: boolean;
  fadeInMs?: number;
  crossfadeMs?: number;
};

type StopOptions = {
  fadeOutMs?: number;
};

type AudioState = {
  bgm: HTMLAudioElement | null;
  bgmPath: string | null;
  bgmVolume: number;
  fadeTimers: Map<HTMLAudioElement, number>;
};

const getAudioState = (): AudioState => {
  const globalKey = "__cutestation_audio_state__";
  const globalScope = globalThis as typeof globalThis & {
    [globalKey]?: AudioState;
  };
  if (!globalScope[globalKey]) {
    globalScope[globalKey] = {
      bgm: null,
      bgmPath: null,
      bgmVolume: 1,
      fadeTimers: new Map<HTMLAudioElement, number>(),
    };
  }
  return globalScope[globalKey];
};

export class AudioManager {
  private state = getAudioState();

  async playBgm(path: string, options: PlayOptions = {}) {
    const loop = options.loop ?? true;
    const fadeInMs = options.fadeInMs ?? 0;
    const crossfadeMs = options.crossfadeMs ?? 0;

    if (!path) {
      return;
    }

    if (this.state.bgm && this.state.bgmPath === path) {
      if (this.state.bgm.paused) {
        this.state.bgm.volume = this.state.bgmVolume;
        try {
          await this.state.bgm.play();
        } catch {
          // Ignore autoplay errors.
        }
      }
      return;
    }

    if (this.state.bgm && crossfadeMs > 0) {
      await this.crossfadeBgm(path, { durationMs: crossfadeMs, loop });
      return;
    }

    const audio = this.createAudio(path, loop);
    this.state.bgm = audio;
    this.state.bgmPath = path;

    if (fadeInMs > 0) {
      audio.volume = 0;
    } else {
      audio.volume = this.state.bgmVolume;
    }

    try {
      await audio.play();
    } catch {
      // Ignore autoplay errors.
    }

    if (fadeInMs > 0) {
      this.fadeVolume(audio, this.state.bgmVolume, fadeInMs);
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

    if (this.state.bgm && this.state.bgmPath === path) {
      if (this.state.bgm.paused) {
        this.state.bgm.volume = this.state.bgmVolume;
        try {
          await this.state.bgm.play();
        } catch {
          // Ignore autoplay errors.
        }
      }
      return;
    }

    const next = this.createAudio(path, loop);
    next.volume = 0;

    try {
      await next.play();
    } catch {
      // Ignore autoplay errors.
    }

    const previous = this.state.bgm;
    this.state.bgm = next;
    this.state.bgmPath = path;

    this.fadeVolume(next, this.state.bgmVolume, durationMs);
    if (previous) {
      this.fadeVolume(previous, 0, durationMs, () => {
        previous.pause();
        previous.currentTime = 0;
      });
    }
  }

  stopBgm(options: StopOptions = {}) {
    if (!this.state.bgm) {
      return;
    }

    const fadeOutMs = options.fadeOutMs ?? 0;
    const current = this.state.bgm;

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
    this.state.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.state.bgm) {
      this.state.bgm.volume = this.state.bgmVolume;
    }
  }

  playSfx(path: string, options: { volume?: number } = {}) {
    if (!path) {
      return;
    }
    const audio = this.createAudio(path, false);
    audio.volume = Math.max(0, Math.min(1, options.volume ?? 1));
    void audio.play().catch(() => {
      // Ignore autoplay errors.
    });
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
    const clampedTarget = Math.max(0, Math.min(1, targetVolume));
    const startVolume = Math.max(0, Math.min(1, audio.volume));
    const delta = clampedTarget - startVolume;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const nextVolume = startVolume + delta * progress;
      audio.volume = Math.max(0, Math.min(1, nextVolume));
      if (progress >= 1) {
        this.clearFade(audio);
        if (onComplete) {
          onComplete();
        }
        return;
      }
      const id = window.requestAnimationFrame(tick);
      this.state.fadeTimers.set(audio, id);
    };

    const id = window.requestAnimationFrame(tick);
    this.state.fadeTimers.set(audio, id);
  }

  private clearFade(audio: HTMLAudioElement) {
    const id = this.state.fadeTimers.get(audio);
    if (id !== undefined) {
      window.cancelAnimationFrame(id);
      this.state.fadeTimers.delete(audio);
    }
  }
}

export const audioManager = new AudioManager();

const audioManagerKey = "__cutestation_audio_manager__";
const globalScope = globalThis as typeof globalThis & {
  [audioManagerKey]?: AudioManager;
};
const previousManager = globalScope[audioManagerKey];
if (previousManager && previousManager !== audioManager) {
  previousManager.stopBgm({ fadeOutMs: 0 });
}
globalScope[audioManagerKey] = audioManager;
