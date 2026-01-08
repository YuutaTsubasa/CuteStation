import { Application, Container } from "pixi.js";
import { loadLevel, type LevelPoint } from "../game/levels/LevelLoader";
import { LevelRuntime } from "../game/levels/LevelRuntime";
import { LevelVisuals } from "../game/visuals/LevelVisuals";
import { normalizeVisualsConfig, type VisualsConfig } from "../game/visuals/VisualsConfig";
import { Player } from "../game/entities/Player";
import { type Rect } from "../game/systems/Physics";
import { Page } from "./Page";

export class GamePlayPage extends Page {
  private readonly worldScale = 2;
  private readonly baseFloorY = 440;
  private readonly worldPadding = { top: 320, right: 0, bottom: 0, left: 0 };
  private readonly visualsBasePath = "/ProjectContent/Levels/whitePalace/visuals";
  private readonly visualsConfigPath = "/ProjectContent/Levels/whitePalace/visuals/visuals.json";
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private player: Player | null = null;
  private background: Container | null = null;
  private world: Container | null = null;
  private runtime: LevelRuntime | null = null;
  private visuals: LevelVisuals | null = null;
  private platforms: Rect[] = [];
  private worldBounds: { minX: number; minY: number; maxX: number; maxY: number } | null =
    null;
  private coins: LevelPoint[] = [];
  private collectedCoins = new Set<string>();
  private levelCleared = false;
  private tickerHandler: (() => void) | null = null;
  private onRequestExit: (() => void) | null = null;
  private onCoinChange: ((count: number, total: number) => void) | null = null;
  private onLevelClear: (() => void) | null = null;
  private onReady: (() => void) | null = null;
  private inputState = {
    move: 0,
    jump: false,
  };
  private jumpRequested = false;
  private keyDownHandler: ((event: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((event: KeyboardEvent) => void) | null = null;
  private enterToken = 0;

  constructor() {
    super("GamePlay");
  }

  setHost(host: HTMLElement | null) {
    this.host = host;
  }

  setOnRequestExit(handler: (() => void) | null) {
    this.onRequestExit = handler;
  }

  setOnCoinChange(handler: ((count: number, total: number) => void) | null) {
    this.onCoinChange = handler;
  }

  setOnLevelClear(handler: (() => void) | null) {
    this.onLevelClear = handler;
  }

  setOnReady(handler: (() => void) | null) {
    this.onReady = handler;
  }

  override async onEnter() {
    super.onEnter();

    if (!this.host || this.app) {
      return;
    }

    this.enterToken += 1;
    const token = this.enterToken;

    const app = new Application();
    await app.init({ background: "#0b0b0b", resizeTo: this.host });
    if (token !== this.enterToken) {
      app.destroy(true);
      return;
    }
    this.host.appendChild(app.canvas);

    const level = await loadLevel("/ProjectContent/Levels/whitePalace/1-1.json");
    if (token !== this.enterToken) {
      app.destroy(true);
      return;
    }

    const world = new Container();
    const background = new Container();
    app.stage.addChild(background);
    app.stage.addChild(world);

    const runtime = new LevelRuntime(level, {
      worldScale: this.worldScale,
      baseFloorY: this.baseFloorY,
      worldPadding: this.worldPadding,
      showSolids: false,
      showCoins: true,
      showGoal: true,
      showSpawn: false,
    });
    runtime.attach(world);

    const visualsConfig = await this.loadVisualsConfig();
    const visuals = new LevelVisuals(level, runtime, {
      worldScale: this.worldScale,
      visualsBasePath: this.visualsBasePath,
      config: visualsConfig,
    });
    await visuals.load(app);
    visuals.attach(background, world);

    const spawnOffsetY = runtime.worldOffsetY / this.worldScale;
    const player = new Player(level.spawn.x, level.spawn.y - spawnOffsetY, this.worldScale);
    player.mount(world);
    await player.loadAssets();
    if (token !== this.enterToken) {
      app.destroy(true);
      return;
    }

    this.app = app;
    this.player = player;
    this.background = background;
    this.world = world;
    this.runtime = runtime;
    this.visuals = visuals;
    this.platforms = runtime.getSolidsWorld();
    this.worldBounds = runtime.getWorldBounds();
    this.coins = level.coins;
    this.collectedCoins.clear();
    this.levelCleared = false;
    this.onCoinChange?.(0, this.coins.length);
    this.onReady?.();

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

      this.checkCoins();
      this.checkGoal();

      if (this.world) {
        const viewCenterX = this.app.renderer.width * 0.5;
        const viewCenterY = this.app.renderer.height * 0.5;
        const playerCenterX = this.player.position.x + this.player.width * 0.5;
        const playerCenterY = this.player.position.y + this.player.height * 0.5;
        const targetX = -playerCenterX + viewCenterX;
        const targetY = -playerCenterY + viewCenterY;
        const clamped = this.clampCamera(targetX, targetY);

        this.world.x += (clamped.x - this.world.x) * 0.08;
        this.world.y += (clamped.y - this.world.y) * 0.08;

        this.visuals?.update(this.world.x, this.world.y, this.app);
      }
    };

    app.ticker.add(this.tickerHandler);
    // TODO: expand scene setup in Phase 5.
  }

  override onExit() {
    this.enterToken += 1;

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

    if (this.runtime) {
      this.runtime.destroy();
      this.runtime = null;
    }

    if (this.visuals) {
      this.visuals.destroy();
      this.visuals = null;
    }

    if (this.background) {
      this.background.removeFromParent();
      this.background.destroy({ children: false });
      this.background = null;
    }

    if (this.world) {
      this.world.removeFromParent();
      this.world.destroy({ children: false });
      this.world = null;
    }
    this.worldBounds = null;
    this.platforms = [];
    this.coins = [];
    this.collectedCoins.clear();
    this.levelCleared = false;

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

  private clampCamera(targetX: number, targetY: number) {
    if (!this.app || !this.worldBounds) {
      return { x: targetX, y: targetY };
    }

    const viewWidth = this.app.renderer.width;
    const viewHeight = this.app.renderer.height;
    const minX = viewWidth - this.worldBounds.maxX;
    const maxX = -this.worldBounds.minX;
    const minY = viewHeight - this.worldBounds.maxY;
    const maxY = -this.worldBounds.minY;

    return {
      x: Math.min(Math.max(targetX, minX), maxX),
      y: Math.min(Math.max(targetY, minY), maxY),
    };
  }

  private checkCoins() {
    if (!this.player || !this.runtime) {
      return;
    }

    const rect = this.player.getRect();
    const radius = 16 * this.worldScale;
    for (const coin of this.coins) {
      if (this.collectedCoins.has(coin.id)) {
        continue;
      }

      const worldPoint = this.runtime.toWorldPoint(coin);
      const hit = this.rectCircleOverlap(
        rect,
        { x: worldPoint.x, y: worldPoint.y, r: radius },
      );

      if (hit) {
        this.collectedCoins.add(coin.id);
        this.runtime.collectCoin(coin.id);
        this.onCoinChange?.(this.collectedCoins.size, this.coins.length);
      }
    }
  }

  private checkGoal() {
    if (!this.player || !this.runtime || this.levelCleared) {
      return;
    }

    const goalRect = this.runtime.getGoalWorld();
    if (!goalRect) {
      return;
    }

    if (this.rectsOverlap(this.player.getRect(), goalRect)) {
      this.levelCleared = true;
      this.onLevelClear?.();
    }
  }

  private rectsOverlap(a: Rect, b: Rect) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  private rectCircleOverlap(
    rect: Rect,
    circle: { x: number; y: number; r: number },
  ) {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy <= circle.r * circle.r;
  }

  private async loadVisualsConfig(): Promise<VisualsConfig> {
    const response = await fetch(this.visualsConfigPath);
    if (!response.ok) {
      throw new Error(`Failed to load visuals config: ${this.visualsConfigPath}`);
    }
    const config = (await response.json()) as VisualsConfig;
    return normalizeVisualsConfig(config);
  }
}
