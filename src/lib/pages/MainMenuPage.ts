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
  private screenBgLayer: Container | null = null;
  private screenUiLayer: Container | null = null;
  private pressLayer: Container | null = null;
  private optionsLayer: Container | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private videoTexture: Texture | null = null;
  private videoSprite: Sprite | null = null;
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
    await app.init({ background: "#0b0b0b", width: GAME_WIDTH, height: GAME_HEIGHT });
    this.host.appendChild(app.canvas);

    if (!this.isActive) {
      app.destroy(true);
      app.canvas.remove();
      return;
    }

    const screenBgLayer = new Container();
    const screenUiLayer = new Container();
    const pressLayer = new Container();
    const optionsLayer = new Container();
    optionsLayer.alpha = 0;
    optionsLayer.visible = false;
    optionsLayer.interactiveChildren = false;
    app.stage.addChild(screenBgLayer);
    app.stage.addChild(screenUiLayer);
    screenUiLayer.addChild(pressLayer);
    screenUiLayer.addChild(optionsLayer);

    this.screenBgLayer = screenBgLayer;
    this.screenUiLayer = screenUiLayer;
    this.pressLayer = pressLayer;
    this.optionsLayer = optionsLayer;
    this.enteringState = "press";
    this.transitionElapsed = 0;

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

    const { videoElement, videoSprite, videoTexture } = this.createVideoBackground();
    screenBgLayer.addChild(videoSprite);
    const overlay = new Graphics();
    overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x000000, alpha: this.overlayAlpha });
    screenBgLayer.addChild(overlay);

    this.videoElement = videoElement;
    this.videoTexture = videoTexture;
    this.videoSprite = videoSprite;

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

    const pressBarWidth = GAME_WIDTH * 0.7;
    const pressBarHeight = GAME_HEIGHT * 0.08;
    const pressBar = new Graphics();
    pressBar
      .roundRect(0, 0, pressBarWidth, pressBarHeight, pressBarHeight * 0.5)
      .fill(0x2f64d2);
    pressBar.position.set((GAME_WIDTH - pressBarWidth) * 0.5, GAME_HEIGHT * 0.68);
    pressLayer.addChild(pressBar);

    const pressText = new Text({
      text: "PRESS ANYTHING TO START",
      style: new TextStyle({
        fill: 0xffffff,
        fontSize: pressBarHeight * 0.42,
        fontWeight: "700",
        letterSpacing: 3,
      }),
    });
    pressText.anchor.set(0.5);
    pressText.position.set(
      GAME_WIDTH * 0.5,
      pressBar.position.y + pressBarHeight * 0.5,
    );
    pressLayer.addChild(pressText);

    const buttonStyle = new TextStyle({
      fill: 0xffffff,
      fontSize: 48,
      fontWeight: "700",
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
      this.videoElement = null;
    }

    this.videoSprite?.destroy();
    this.videoSprite = null;
    this.videoTexture?.destroy(true);
    this.videoTexture = null;
    this.screenBgLayer?.destroy({ children: true });
    this.screenUiLayer?.destroy({ children: true });
    this.screenBgLayer = null;
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
    this.enteringState = "options";
    this.transitionElapsed = 0;
    if (this.optionsLayer) {
      this.optionsLayer.visible = true;
    }
  }

  private createVideoBackground() {
    const video = document.createElement("video");
    video.src = this.videoPath;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const texture = Texture.from(video);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);

    const updateCover = () => {
      if (!video.videoWidth || !video.videoHeight) {
        return;
      }
      const scale = Math.max(
        GAME_WIDTH / video.videoWidth,
        GAME_HEIGHT / video.videoHeight,
      );
      sprite.width = video.videoWidth * scale;
      sprite.height = video.videoHeight * scale;
      sprite.position.set(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5);
    };

    if (video.readyState >= 1) {
      updateCover();
    } else {
      video.addEventListener("loadedmetadata", updateCover, { once: true });
    }

    void video.play().catch(() => {
      // Autoplay may be blocked until user interaction.
    });

    return { videoElement: video, videoTexture: texture, videoSprite: sprite };
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
