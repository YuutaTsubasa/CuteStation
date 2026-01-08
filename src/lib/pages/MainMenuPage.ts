import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from "pixi.js";
import { audioManager } from "../game/audio/AudioManager";
import { menuBgmPath } from "../game/audio/audioPaths";
import { GAME_HEIGHT, GAME_WIDTH } from "../game/view/ResolutionManager";
import { Page } from "./Page";

type MenuEntry = {
  id: string;
  label: string;
};

export class MainMenuPage extends Page {
  readonly entries: MenuEntry[] = [
    { id: "GamePlay", label: "Start Game" },
    { id: "LevelEditor", label: "Level Editor" },
  ];
  private readonly logoPath = "/ProjectContent/UI/gameLogo.png";
  private readonly videoPath = "/ProjectContent/UI/mainMenuBackground.mp4";
  private readonly overlayAlpha = 0.45;
  private readonly transitionSeconds = 0.35;
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
    audioManager.stopBgm({ fadeOutMs: 200 });
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

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

    this.backgroundHost = this.host;
    this.createVideoBackgroundDom();

    const logoTexture = await Assets.load<Texture>(this.logoPath);
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
      "START GAME",
      GAME_HEIGHT * 0.54,
      buttonWidth,
      buttonHeight,
      buttonStyle,
      () => this.onNavigate?.("GamePlay"),
    );
    const editorButton = this.createMenuButton(
      "LEVEL EDITOR",
      GAME_HEIGHT * 0.66,
      buttonWidth,
      buttonHeight,
      buttonStyle,
      () => this.onNavigate?.("LevelEditor"),
    );
    optionsLayer.addChild(startButton, editorButton);

    this.keyHandler = () => {
      this.handlePressToStart();
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

      if (this.enteringState === "press") {
        return;
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
    }
    if (this.pressStartElement) {
      const element = this.pressStartElement;
      element.classList.add("pressStartHidden");
      window.setTimeout(() => {
        if (element.isConnected) {
          element.remove();
        }
      }, Math.round(this.transitionSeconds * 1000) + 50);
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
    label: string,
    y: number,
    width: number,
    height: number,
    style: TextStyle,
    onClick: () => void,
  ) {
    const container = new Container();
    container.eventMode = "static";
    container.cursor = "pointer";
    container.hitArea = new Rectangle(0, 0, width, height);

    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, height * 0.5).fill(0x1f1f1f);
    container.addChild(bg);

    const text = new Text({ text: label, style });
    text.anchor.set(0.5);
    text.position.set(width * 0.5, height * 0.5);
    container.addChild(text);

    container.position.set((GAME_WIDTH - width) * 0.5, y);
    container.on("pointertap", onClick);
    return container;
  }
}
