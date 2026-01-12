import {
  Application,
  Assets,
  Container,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from "pixi.js";
import { get } from "svelte/store";
import { audioManager } from "../game/audio/AudioManager";
import { menuBgmPath } from "../game/audio/audioPaths";
import { GamepadTracker } from "../game/input/GamepadTracker";
import { assetManifest } from "../game/assets/AssetManifest";
import { GAME_HEIGHT, GAME_WIDTH } from "../game/view/ResolutionManager";
import { LocalizationStore, t } from "../systems/LocalizationStore";
import { Page } from "./Page";

type MenuEntry = {
  id: string;
  label: string;
};

type MenuButton = {
  container: Container;
  background: Sprite;
  labelKey: string;
  text: Text;
  onClick: () => void;
  width: number;
  height: number;
};

export class MainMenuPage extends Page {
  readonly entries: MenuEntry[] = [
    { id: "GamePlay", label: "Start Game" },
    { id: "LevelEditor", label: "Level Editor" },
    { id: "Settings", label: "Settings" },
  ];
  private readonly logoPath = assetManifest.ui.gameLogo;
  private readonly videoPath = assetManifest.ui.mainMenuBackgroundVideo;
  private readonly overlayAlpha = 0.45;
  private readonly transitionSeconds = 0.2;
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private screenUiLayer: Container | null = null;
  private pressLayer: Container | null = null;
  private optionsLayer: Container | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private videoOverlay: HTMLDivElement | null = null;
  private backgroundHost: HTMLElement | null = null;
  private pressStartElement: HTMLDivElement | null = null;
  private tickerHandler: (() => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;
  private pointerHandler: ((event: PointerEvent) => void) | null = null;
  private onNavigate: ((id: string) => void) | null = null;
  private enteringState: "press" | "options" = "press";
  private transitionElapsed = 0;
  private menuButtons: MenuButton[] = [];
  private selectedIndex = 0;
  private gamepadInput: GamepadTracker | null = null;
  private lastGamepadNav = 0;
  private readonly gamepadNavCooldownMs = 180;
  private localeUnsubscribe: (() => void) | null = null;

  constructor() {
    super("MainMenu");
  }

  setHost(host: HTMLElement | null) {
    this.host = host;
  }

  setOnNavigate(handler: ((id: string) => void) | null) {
    this.onNavigate = handler;
  }

  override async onEnter() {
    super.onEnter();
    void audioManager.playBgm(menuBgmPath, { loop: true, crossfadeMs: 400 });

    if (!this.host || this.app) {
      return;
    }

    const app = new Application();
    await app.init({
      background: "#000000",
      backgroundAlpha: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    });
    this.host.appendChild(app.canvas);

    if (!this.isActive) {
      app.destroy(true);
      app.canvas.remove();
      return;
    }

    const screenUiLayer = new Container();
    const pressLayer = new Container();
    const optionsLayer = new Container();
    optionsLayer.alpha = 0;
    optionsLayer.visible = false;
    optionsLayer.interactiveChildren = false;
    app.stage.addChild(screenUiLayer);
    screenUiLayer.addChild(pressLayer);
    screenUiLayer.addChild(optionsLayer);

    this.screenUiLayer = screenUiLayer;
    this.pressLayer = pressLayer;
    this.optionsLayer = optionsLayer;
    this.enteringState = "press";
    this.transitionElapsed = 0;
    this.menuButtons = [];
    this.selectedIndex = 0;
    this.gamepadInput = new GamepadTracker();

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

    this.backgroundHost = this.host;
    this.createVideoBackgroundDom();

    const logoTexture = await Assets.load<Texture>(this.logoPath);
    const buttonTexture = await Assets.load<Texture>(
      assetManifest.ui.backgroundWhiteButton,
    );
    if (!this.isActive) {
      app.destroy(true);
      app.canvas.remove();
      return;
    }

    const logo = new Sprite(logoTexture);
    logo.anchor.set(0.5);
    logo.position.set(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.28);
    this.scaleLogo(logo);
    pressLayer.addChild(logo);
    this.createPressStart();

    const buttonStyle = new TextStyle({
      fill: 0xffffff,
      fontSize: 48,
      fontWeight: "700",
      fontFamily: "Gabarito, Noto Sans TC, sans-serif",
      letterSpacing: 2,
    });
    const buttonWidth = 520;
    const buttonHeight = 88;
    const startButton = this.createMenuButton(
      "MENU_START",
      GAME_HEIGHT * 0.54,
      buttonWidth,
      buttonHeight,
      buttonStyle,
      buttonTexture,
      () => this.onNavigate?.("GamePlay"),
    );
    const editorButton = this.createMenuButton(
      "MENU_LEVEL_EDITOR",
      GAME_HEIGHT * 0.66,
      buttonWidth,
      buttonHeight,
      buttonStyle,
      buttonTexture,
      () => this.onNavigate?.("LevelEditor"),
    );
    const settingsButton = this.createMenuButton(
      "MENU_SETTINGS",
      GAME_HEIGHT * 0.78,
      buttonWidth,
      buttonHeight,
      buttonStyle,
      buttonTexture,
      () => this.onNavigate?.("Settings"),
    );
    this.menuButtons = [startButton, editorButton, settingsButton];
    optionsLayer.addChild(
      startButton.container,
      editorButton.container,
      settingsButton.container,
    );
    this.applyMenuSelection();
    this.localeUnsubscribe = LocalizationStore.locale.subscribe(() => {
      this.refreshMenuLabels();
    });
    this.refreshMenuLabels();

    this.keyHandler = (event) => {
      if (this.enteringState === "press") {
        this.handlePressToStart();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        this.moveSelection(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        this.moveSelection(1);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.activateSelection();
      }
    };
    this.pointerHandler = () => {
      this.handlePressToStart();
    };
    window.addEventListener("keydown", this.keyHandler);
    window.addEventListener("pointerdown", this.pointerHandler);

    this.tickerHandler = () => {
      if (!this.pressLayer || !this.optionsLayer) {
        return;
      }

      const gamepadState = this.gamepadInput?.poll();

      if (this.enteringState === "press") {
        if (gamepadState?.anyButtonDown) {
          this.handlePressToStart();
        }
        return;
      }

      if (gamepadState) {
        this.handleGamepadMenuInput(gamepadState);
      }

      if (this.transitionElapsed < this.transitionSeconds) {
        this.transitionElapsed += app.ticker.deltaMS / 1000;
        const t = Math.min(1, this.transitionElapsed / this.transitionSeconds);
        this.pressLayer.alpha = 1 - t;
        this.optionsLayer.alpha = t;
        if (t >= 1) {
          this.optionsLayer.interactiveChildren = true;
        }
      }
    };
    app.ticker.add(this.tickerHandler);

    this.app = app;
  }

  override onExit() {
    if (this.localeUnsubscribe) {
      this.localeUnsubscribe();
      this.localeUnsubscribe = null;
    }
    if (this.app && this.tickerHandler) {
      this.app.ticker.remove(this.tickerHandler);
      this.tickerHandler = null;
    }

    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }

    if (this.pointerHandler) {
      window.removeEventListener("pointerdown", this.pointerHandler);
      this.pointerHandler = null;
    }

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute("src");
      this.videoElement.load();
      this.videoElement.remove();
      this.videoElement = null;
    }
    if (this.videoOverlay) {
      this.videoOverlay.remove();
      this.videoOverlay = null;
    }
    if (this.pressStartElement) {
      this.pressStartElement.remove();
      this.pressStartElement = null;
    }
    this.backgroundHost = null;
    this.menuButtons = [];
    this.gamepadInput = null;

    this.screenUiLayer?.destroy({ children: true });
    this.screenUiLayer = null;
    this.pressLayer = null;
    this.optionsLayer = null;

    if (this.app) {
      const canvas = this.app.canvas;
      this.app.destroy(true);
      this.app = null;
      canvas.remove();
    }

    super.onExit();
  }

  private handlePressToStart() {
    if (this.enteringState !== "press") {
      return;
    }
    if (this.videoElement?.paused) {
      void this.videoElement.play().catch(() => {
        // Ignore if still blocked.
      });
    }
    this.enteringState = "options";
    this.transitionElapsed = 0;
    if (this.optionsLayer) {
      this.optionsLayer.visible = true;
      this.applyMenuSelection();
    }
    if (this.pressStartElement) {
      const element = this.pressStartElement;
      element.remove();
      this.pressStartElement = null;
    }
  }

  private createVideoBackgroundDom() {
    if (!this.backgroundHost) {
      return;
    }

    const video = document.createElement("video");
    const resolvedUrl = new URL(this.videoPath, window.location.href).toString();
    video.src = resolvedUrl;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.preload = "auto";
    video.style.position = "absolute";
    video.style.inset = "0";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.style.zIndex = "0";
    this.backgroundHost.appendChild(video);

    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.background = `rgba(0, 0, 0, ${this.overlayAlpha})`;
    overlay.style.zIndex = "1";
    this.backgroundHost.appendChild(overlay);

    video.load();
    let started = false;
    const tryStart = () => {
      if (started || video.paused === false) {
        return;
      }
      started = true;
      void video.play().catch(() => {
        started = false;
      });
    };
    if (video.readyState >= 2) {
      tryStart();
    } else {
      video.addEventListener("canplay", tryStart, { once: true });
    }

    this.videoElement = video;
    this.videoOverlay = overlay;
  }

  private createPressStart() {
    if (!this.backgroundHost) {
      return;
    }
    const pressStart = document.createElement("div");
    pressStart.className = "pressStart slowFlicker";
    pressStart.textContent = "PRESS TO START";
    this.backgroundHost.appendChild(pressStart);
    this.pressStartElement = pressStart;
  }

  private scaleLogo(logo: Sprite) {
    const maxLogoWidth = GAME_WIDTH * 0.5;
    if (logo.width <= 0) {
      return;
    }
    const scale = Math.min(1, maxLogoWidth / logo.width);
    logo.scale.set(scale);
  }

  private createMenuButton(
    labelKey: string,
    y: number,
    width: number,
    height: number,
    style: TextStyle,
    texture: Texture,
    onClick: () => void,
  ) {
    const container = new Container();
    container.eventMode = "static";
    container.cursor = "pointer";
    container.hitArea = new Rectangle(0, 0, width, height);

    const bg = new Sprite(texture);
    bg.width = width;
    bg.height = height;
    bg.tint = 0x1f1f1f;
    container.addChild(bg);

    const text = new Text({ text: this.translate(labelKey), style });
    text.anchor.set(0.5);
    text.position.set(width * 0.5, height * 0.5);
    container.addChild(text);

    container.position.set((GAME_WIDTH - width) * 0.5, y);
    container.on("pointertap", () => {
      audioManager.playSfx(assetManifest.audio.sfx.confirm);
      onClick();
    });
    container.on("pointerover", () => {
      if (this.enteringState !== "options") {
        return;
      }
      const index = this.menuButtons.findIndex((button) => button.container === container);
      if (index >= 0) {
        this.selectedIndex = index;
        this.applyMenuSelection();
      }
    });
    return { container, background: bg, labelKey, text, onClick, width, height };
  }

  private applyMenuSelection() {
    this.menuButtons.forEach((button, index) => {
      const selected = index === this.selectedIndex;
      button.background.tint = selected ? 0x3b7cff : 0x1f1f1f;
    });
  }

  private moveSelection(direction: number) {
    if (this.menuButtons.length === 0) {
      return;
    }
    this.selectedIndex = Math.max(
      0,
      Math.min(this.menuButtons.length - 1, this.selectedIndex + direction),
    );
    this.applyMenuSelection();
  }

  private activateSelection() {
    const button = this.menuButtons[this.selectedIndex];
    if (!button) {
      return;
    }
    button.onClick();
  }

  private translate(key: string) {
    const translator = get(t);
    return translator(key);
  }

  private refreshMenuLabels() {
    this.menuButtons.forEach((button) => {
      button.text.text = this.translate(button.labelKey);
    });
  }

  private handleGamepadMenuInput(
    state: NonNullable<ReturnType<GamepadTracker["poll"]>>,
  ) {
    const now = performance.now();
    if (now - this.lastGamepadNav > this.gamepadNavCooldownMs) {
      if (state.moveY < -0.6) {
        this.moveSelection(-1);
        this.lastGamepadNav = now;
      } else if (state.moveY > 0.6) {
        this.moveSelection(1);
        this.lastGamepadNav = now;
      }
    }
    if (
      state.buttonsDown[0] ||
      state.buttonsDown[1] ||
      state.buttonsDown[2] ||
      state.buttonsDown[3]
    ) {
      this.activateSelection();
    }
  }
}
