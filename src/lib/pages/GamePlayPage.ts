import { Application } from "pixi.js";
import { Player } from "../game/entities/Player";
import { Page } from "./Page";

export class GamePlayPage extends Page {
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private player: Player | null = null;
  private tickerHandler: (() => void) | null = null;
  private onRequestExit: (() => void) | null = null;
  private inputState = {
    move: 0,
    jump: false,
  };
  private jumpRequested = false;
  private keyDownHandler: ((event: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super("GamePlay");
  }

  setHost(host: HTMLElement | null) {
    this.host = host;
  }

  setOnRequestExit(handler: (() => void) | null) {
    this.onRequestExit = handler;
  }

  override async onEnter() {
    super.onEnter();

    if (!this.host || this.app) {
      return;
    }

    const app = new Application();
    await app.init({ background: "#0b0b0b", resizeTo: this.host });
    this.host.appendChild(app.canvas);

    const player = new Player();
    player.mount(app.stage);

    this.app = app;
    this.player = player;

    this.keyDownHandler = (event) => {
      if (event.repeat) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        this.inputState.move = -1;
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        this.inputState.move = 1;
      }

      if (event.key === " ") {
        this.jumpRequested = true;
      }

      if (event.key === "Escape") {
        this.onRequestExit?.();
      }
    };

    this.keyUpHandler = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        if (this.inputState.move < 0) {
          this.inputState.move = 0;
        }
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        if (this.inputState.move > 0) {
          this.inputState.move = 0;
        }
      }
    };

    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);

    this.tickerHandler = () => {
      if (!this.app || !this.player) {
        return;
      }

      const deltaSeconds = this.app.ticker.deltaMS / 1000;
      this.inputState.jump = this.jumpRequested;
      this.jumpRequested = false;
      this.player.update(deltaSeconds, this.inputState);
    };

    app.ticker.add(this.tickerHandler);
    // TODO: expand scene setup in Phase 4.
  }

  override onExit() {
    if (this.app && this.tickerHandler) {
      this.app.ticker.remove(this.tickerHandler);
      this.tickerHandler = null;
    }

    if (this.keyDownHandler) {
      window.removeEventListener("keydown", this.keyDownHandler);
      this.keyDownHandler = null;
    }

    if (this.keyUpHandler) {
      window.removeEventListener("keyup", this.keyUpHandler);
      this.keyUpHandler = null;
    }

    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    if (this.app) {
      const canvas = this.app.canvas;
      this.app.destroy(true);
      this.app = null;
      canvas.remove();
    }

    super.onExit();
  }

  override update(_deltaMs: number) {
    // TODO: update gameplay once the loop is wired.
  }
}
