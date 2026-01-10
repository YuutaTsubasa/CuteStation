import { Application, Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import { audioManager } from "../game/audio/AudioManager";
import { assetManifest } from "../game/assets/AssetManifest";
import { GAME_HEIGHT, GAME_WIDTH } from "../game/view/ResolutionManager";
import { Page } from "./Page";

export class SplashScreenPage extends Page {
  private readonly logoPath = assetManifest.ui.creatorLogo;
  private readonly fadeInSeconds = 1;
  private readonly holdSeconds = 2.5;
  private readonly fadeOutSeconds = 1;
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private root: Container | null = null;
  private tickerHandler: (() => void) | null = null;
  private onComplete: (() => void) | null = null;
  private elapsedSeconds = 0;
  private enterToken = 0;

  constructor() {
    super("SplashScreen");
  }

  setHost(host: HTMLElement | null) {
    this.host = host;
  }

  setOnComplete(handler: (() => void) | null) {
    this.onComplete = handler;
  }

  override async onEnter() {
    super.onEnter();
    audioManager.stopBgm({ fadeOutMs: 200 });

    if (!this.host || this.app) {
      return;
    }

    this.enterToken += 1;
    const token = this.enterToken;

    const app = new Application();
    await app.init({ background: "#000000", width: GAME_WIDTH, height: GAME_HEIGHT });
    this.host.appendChild(app.canvas);

    if (!this.isActive) {
      app.destroy(true);
      app.canvas.remove();
      return;
    }

    const root = new Container();
    root.alpha = 0;
    app.stage.addChild(root);

    const background = new Graphics();
    background.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(0xffffff);
    root.addChild(background);

    const logoTexture = await Assets.load<Texture>(this.logoPath);
    if (token !== this.enterToken) {
      app.destroy(true);
      app.canvas.remove();
      return;
    }

    const logo = new Sprite(logoTexture);
    logo.anchor.set(0.5);
    logo.position.set(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5);
    const maxLogoWidth = GAME_WIDTH / 3;
    if (logo.width > 0) {
      const scale = Math.min(1, maxLogoWidth / logo.width);
      logo.scale.set(scale);
    }
    root.addChild(logo);

    this.elapsedSeconds = 0;
    const totalSeconds = this.fadeInSeconds + this.holdSeconds + this.fadeOutSeconds;
    this.tickerHandler = () => {
      this.elapsedSeconds += app.ticker.deltaMS / 1000;
      const t = this.elapsedSeconds;
      let alpha = 0;

      if (t < this.fadeInSeconds) {
        alpha = t / this.fadeInSeconds;
      } else if (t < this.fadeInSeconds + this.holdSeconds) {
        alpha = 1;
      } else if (t < totalSeconds) {
        alpha = 1 - (t - this.fadeInSeconds - this.holdSeconds) / this.fadeOutSeconds;
      }

      root.alpha = Math.max(0, Math.min(1, alpha));

      if (t >= totalSeconds) {
        if (this.tickerHandler) {
          app.ticker.remove(this.tickerHandler);
          this.tickerHandler = null;
        }
        this.onComplete?.();
      }
    };
    app.ticker.add(this.tickerHandler);

    this.app = app;
    this.root = root;
  }

  override onExit() {
    this.enterToken += 1;

    if (this.app && this.tickerHandler) {
      this.app.ticker.remove(this.tickerHandler);
      this.tickerHandler = null;
    }

    if (this.root) {
      this.root.removeFromParent();
      this.root.destroy({ children: true });
      this.root = null;
    }

    if (this.app) {
      const canvas = this.app.canvas;
      this.app.destroy(true);
      this.app = null;
      canvas.remove();
    }

    super.onExit();
  }
}
