import { Application } from "pixi.js";
import { audioManager } from "../game/audio/AudioManager";
import { GAME_HEIGHT, GAME_WIDTH } from "../game/view/ResolutionManager";
import { Page } from "./Page";

export class SplashScreenPage extends Page {
  private app: Application | null = null;
  private host: HTMLElement | null = null;

  constructor() {
    super("SplashScreen");
  }

  setHost(host: HTMLElement | null) {
    this.host = host;
  }

  override async onEnter() {
    super.onEnter();
    audioManager.stopBgm({ fadeOutMs: 200 });
    // TODO: add splash screen visuals and timing in Phase 2.

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

    this.app = app;
  }

  override onExit() {
    if (this.app) {
      const canvas = this.app.canvas;
      this.app.destroy(true);
      this.app = null;
      canvas.remove();
    }

    super.onExit();
  }
}
