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
  sfxVolume: number;
  audioContext: AudioContext | null;
  sfxGain: GainNode | null;
  audioNodes: WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>;
  gainNodes: WeakMap<HTMLAudioElement, GainNode>;
  fadeTimers: Map<HTMLAudioElement, number>;
};

const isIOSDevice = () => {
  if (typeof navigator === "undefined") {
    return false;
  }
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
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
      sfxVolume: 1,
      audioContext: null,
      sfxGain: null,
      audioNodes: new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>(),
      gainNodes: new WeakMap<HTMLAudioElement, GainNode>(),
      fadeTimers: new Map<HTMLAudioElement, number>(),
    };
  }
  return globalScope[globalKey];
};

export class AudioManager {
  private state = getAudioState();

  private shouldUseWebAudio() {
    return isIOSDevice() && typeof AudioContext !== "undefined";
  }

  private ensureAudioContext() {
    if (!this.shouldUseWebAudio()) {
      return null;
    }
    if (!this.state.audioContext) {
      this.state.audioContext = new AudioContext();
      this.state.sfxGain = this.state.audioContext.createGain();
      this.state.sfxGain.gain.value = this.state.sfxVolume;
      this.state.sfxGain.connect(this.state.audioContext.destination);
    }
    return this.state.audioContext;
  }

  private async resumeAudioContext() {
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        // Ignore resume errors.
      }
    }
  }

  private attachBgmAudio(audio: HTMLAudioElement) {
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }
    if (this.state.audioNodes.has(audio)) {
      return;
    }
    const source = context.createMediaElementSource(audio);
    const gain = context.createGain();
    gain.gain.value = this.state.bgmVolume;
    source.connect(gain);
    gain.connect(context.destination);
    this.state.audioNodes.set(audio, source);
    this.state.gainNodes.set(audio, gain);
  }

  private attachSfxAudio(audio: HTMLAudioElement, baseVolume: number) {
    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }
    if (this.state.audioNodes.has(audio)) {
      return;
    }
    const source = context.createMediaElementSource(audio);
    const gain = context.createGain();
    gain.gain.value = Math.max(0, Math.min(1, baseVolume));
    source.connect(gain);
    if (this.state.sfxGain) {
      gain.connect(this.state.sfxGain);
    } else {
      gain.connect(context.destination);
    }
    this.state.audioNodes.set(audio, source);
    this.state.gainNodes.set(audio, gain);
  }

  private setAudioOutputVolume(audio: HTMLAudioElement, volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    const gain = this.state.gainNodes.get(audio);
    if (gain && this.shouldUseWebAudio()) {
      gain.gain.value = clamped;
      return;
    }
    audio.volume = clamped;
  }

  private getAudioOutputVolume(audio: HTMLAudioElement) {
    const gain = this.state.gainNodes.get(audio);
    if (gain && this.shouldUseWebAudio()) {
      return gain.gain.value;
    }
    return audio.volume;
  }

  async playBgm(path: string, options: PlayOptions = {}) {
    const loop = options.loop ?? true;
    const fadeInMs = options.fadeInMs ?? 0;
    const crossfadeMs = options.crossfadeMs ?? 0;

    if (!path) {
      return;
    }

    if (this.state.bgm && this.state.bgmPath === path) {
      if (this.state.bgm.paused) {
        this.setAudioOutputVolume(this.state.bgm, this.state.bgmVolume);
        await this.resumeAudioContext();
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

    const audio = this.createAudio(path, loop, "bgm");
    this.state.bgm = audio;
    this.state.bgmPath = path;

    if (fadeInMs > 0) {
      this.setAudioOutputVolume(audio, 0);
    } else {
      this.setAudioOutputVolume(audio, this.state.bgmVolume);
    }

    await this.resumeAudioContext();
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
        this.setAudioOutputVolume(this.state.bgm, this.state.bgmVolume);
        await this.resumeAudioContext();
        try {
          await this.state.bgm.play();
        } catch {
          // Ignore autoplay errors.
        }
      }
      return;
    }

    const next = this.createAudio(path, loop, "bgm");
    this.setAudioOutputVolume(next, 0);

    await this.resumeAudioContext();
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
      this.setAudioOutputVolume(this.state.bgm, this.state.bgmVolume);
    }
  }

  getBgmVolume() {
    return this.state.bgmVolume;
  }

  setSfxVolume(volume: number) {
    this.state.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.state.sfxGain && this.shouldUseWebAudio()) {
      this.state.sfxGain.gain.value = this.state.sfxVolume;
    }
  }

  getSfxVolume() {
    return this.state.sfxVolume;
  }

  playSfx(path: string, options: { volume?: number } = {}) {
    if (!path) {
      return;
    }
    const base = Math.max(0, Math.min(1, options.volume ?? 1));
    const audio = this.createAudio(path, false, "sfx", base);
    if (!this.shouldUseWebAudio()) {
      audio.volume = Math.max(0, Math.min(1, base * this.state.sfxVolume));
    }
    void this.resumeAudioContext();
    void audio.play().catch(() => {
      // Ignore autoplay errors.
    });
  }

  private createAudio(
    path: string,
    loop: boolean,
    channel: "bgm" | "sfx",
    baseVolume = 1,
  ) {
    const audio = new Audio(path);
    audio.loop = loop;
    audio.preload = "auto";
    if (this.shouldUseWebAudio()) {
      if (channel === "bgm") {
        this.attachBgmAudio(audio);
      } else {
        this.attachSfxAudio(audio, baseVolume);
      }
    }
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
    const startVolume = Math.max(0, Math.min(1, this.getAudioOutputVolume(audio)));
    const delta = clampedTarget - startVolume;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const nextVolume = startVolume + delta * progress;
      this.setAudioOutputVolume(audio, nextVolume);
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
