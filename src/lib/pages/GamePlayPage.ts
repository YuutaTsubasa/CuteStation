import { Application, Container, Graphics } from "pixi.js";
import { Player } from "../game/entities/Player";
import { type Rect } from "../game/systems/Physics";
import { Page } from "./Page";

export class GamePlayPage extends Page {
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private player: Player | null = null;
  private world: Container | null = null;
  private platforms: Rect[] = [];
  private platformGraphics: Graphics[] = [];
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

    const world = new Container();
    app.stage.addChild(world);

    const platforms: Rect[] = [
      { x: -200, y: 440, width: 1200, height: 40 },
      { x: 120, y: 340, width: 180, height: 24 },
      { x: 380, y: 280, width: 160, height: 24 },
      { x: 620, y: 220, width: 160, height: 24 },
    ];

    const platformGraphics = platforms.map((platform) => {
      const gfx = new Graphics();
      gfx.rect(0, 0, platform.width, platform.height).fill(0x3c3c3c);
      gfx.x = platform.x;
      gfx.y = platform.y;
      world.addChild(gfx);
      return gfx;
    });

    const player = new Player();
    player.mount(world);

    this.app = app;
    this.player = player;
    this.world = world;
    this.platforms = platforms;
    this.platformGraphics = platformGraphics;

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
      this.player.update(deltaSeconds, this.inputState, this.platforms);

      if (this.world) {
        const viewCenterX = this.app.renderer.width * 0.5;
        const targetX = -this.player.position.x + viewCenterX;
        this.world.x += (targetX - this.world.x) * 0.08;
      }
    };

    app.ticker.add(this.tickerHandler);
    // TODO: expand scene setup in Phase 5.
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

    if (this.platformGraphics.length > 0) {
      for (const gfx of this.platformGraphics) {
        gfx.destroy();
      }
      this.platformGraphics = [];
    }

    if (this.world) {
      this.world.removeFromParent();
      this.world.destroy({ children: false });
      this.world = null;
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
