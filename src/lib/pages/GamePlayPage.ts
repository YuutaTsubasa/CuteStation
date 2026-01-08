import { Application, Container } from "pixi.js";
import { loadLevel, type LevelPoint } from "../game/levels/LevelLoader";
import { LevelRuntime } from "../game/levels/LevelRuntime";
import { LevelVisuals } from "../game/visuals/LevelVisuals";
import { normalizeVisualsConfig, type VisualsConfig } from "../game/visuals/VisualsConfig";
import { Player } from "../game/entities/Player";
import { audioManager } from "../game/audio/AudioManager";
import { whitePalaceBgmPath } from "../game/audio/audioPaths";
import { type Rect } from "../game/systems/Physics";
import { type VirtualInputState, VirtualInput } from "../game/input/VirtualInput";
import { GAME_HEIGHT, GAME_WIDTH } from "../game/view/ResolutionManager";
import { LevelSession } from "../game/levels/LevelSession";
import { Page } from "./Page";

export class GamePlayPage extends Page {
  private readonly worldScale = 4;
  private readonly baseFloorY = 400;
  private readonly worldPadding = { top: 320, right: 0, bottom: 0, left: 0 };
  private readonly visualsBasePath = "/ProjectContent/Levels/whitePalace/visuals";
  private readonly visualsConfigPath = "/ProjectContent/Levels/whitePalace/visuals/visuals.json";
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private gameRoot: Container | null = null;
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
  private onRequestPlaytestExit: (() => void) | null = null;
  private isPlaytest = false;
  private inputState = {
    move: 0,
    jump: false,
  };
  private keyboardInput: VirtualInputState = {
    moveX: 0,
    jumpDown: false,
    jumpHeld: false,
  };
  private virtualInput: VirtualInput | null = null;
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

  setOnRequestPlaytestExit(handler: (() => void) | null) {
    this.onRequestPlaytestExit = handler;
  }

  setOnReady(handler: (() => void) | null) {
    this.onReady = handler;
  }

  setVirtualInput(input: VirtualInput | null) {
    this.virtualInput = input;
  }

  override async onEnter() {
    super.onEnter();

    if (!this.host || this.app) {
      return;
    }
    this.keyboardInput = { moveX: 0, jumpDown: false, jumpHeld: false };
    this.inputState = { move: 0, jump: false };

    this.enterToken += 1;
    const token = this.enterToken;

    const app = new Application();
    await app.init({ background: "#0b0b0b", width: GAME_WIDTH, height: GAME_HEIGHT });
    if (token !== this.enterToken) {
      app.destroy(true);
      return;
    }
    this.host.appendChild(app.canvas);

    if (!this.isActive) {
      app.destroy(true);
      app.canvas.remove();
      return;
    }

    const abort = () => {
      app.destroy(true);
      app.canvas.remove();
      this.gameRoot = null;
    };

    const gameRoot = new Container();
    app.stage.addChild(gameRoot);
    gameRoot.visible = false;

    this.gameRoot = gameRoot;

    const previewLevel = LevelSession.getPreviewLevel();
    this.isPlaytest = Boolean(previewLevel);
    const level = previewLevel ?? (await loadLevel("/ProjectContent/Levels/whitePalace/1-1.json"));
    if (token !== this.enterToken) {
      abort();
      return;
    }

    const world = new Container();
    const background = new Container();
    gameRoot.addChild(background);
    gameRoot.addChild(world);
    this.background = background;
    this.world = world;

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
    this.runtime = runtime;
    this.platforms = runtime.getSolidsWorld();
    this.worldBounds = runtime.getWorldBounds();

    const visualsConfig = await this.loadVisualsConfig();
    const visuals = new LevelVisuals(level, runtime, {
      worldScale: this.worldScale,
      visualsBasePath: this.visualsBasePath,
      config: visualsConfig,
    });
    await visuals.load(GAME_WIDTH, GAME_HEIGHT);
    visuals.attach(background, world);
    this.visuals = visuals;

    const spawnOffsetY = runtime.worldOffsetY / this.worldScale;
    const player = new Player(level.spawn.x, level.spawn.y - spawnOffsetY, this.worldScale);
    player.mount(world);
    this.player = player;
    this.centerCameraOnPlayer();
    await player.loadAssets();
    if (token !== this.enterToken) {
      abort();
      return;
    }

    void audioManager.crossfadeBgm(whitePalaceBgmPath, {
      durationMs: 500,
      loop: true,
    });

    this.app = app;
    this.coins = level.coins;
    this.collectedCoins.clear();
    this.levelCleared = false;
    this.centerCameraOnPlayer();
    this.gameRoot.visible = true;
    this.onCoinChange?.(0, this.coins.length);
    this.onReady?.();

    this.keyDownHandler = (event) => {
      if (event.repeat) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        this.keyboardInput.moveX = -1;
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        this.keyboardInput.moveX = 1;
      }

      if (event.key === " ") {
        if (!this.keyboardInput.jumpHeld) {
          this.keyboardInput.jumpDown = true;
        }
        this.keyboardInput.jumpHeld = true;
      }

      if (event.key === "Escape") {
        if (this.isPlaytest) {
          this.exitPlaytest();
        } else {
          this.onRequestExit?.();
        }
      }
    };

    this.keyUpHandler = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        if (this.keyboardInput.moveX < 0) {
          this.keyboardInput.moveX = 0;
        }
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        if (this.keyboardInput.moveX > 0) {
          this.keyboardInput.moveX = 0;
        }
      }

      if (event.key === " ") {
        this.keyboardInput.jumpHeld = false;
      }
    };

    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);

    this.tickerHandler = () => {
      if (!this.app || !this.player) {
        return;
      }

      const deltaSeconds = this.app.ticker.deltaMS / 1000;
      const virtualState = this.virtualInput?.consumeFrame() ?? {
        moveX: 0,
        jumpDown: false,
        jumpHeld: false,
      };
      const mergedInput: VirtualInputState = {
        moveX:
          Math.abs(virtualState.moveX) > Math.abs(this.keyboardInput.moveX)
            ? virtualState.moveX
            : this.keyboardInput.moveX,
        jumpDown: this.keyboardInput.jumpDown || virtualState.jumpDown,
        jumpHeld: this.keyboardInput.jumpHeld || virtualState.jumpHeld,
      };

      this.keyboardInput.jumpDown = false;
      this.inputState.move = mergedInput.moveX;
      this.inputState.jump = mergedInput.jumpDown;
      this.player.update(deltaSeconds, this.inputState, this.platforms);
      if (this.worldBounds) {
        this.player.clampToBounds(this.worldBounds);
      }

      this.checkCoins();
      this.checkGoal();

      if (this.world) {
        const viewCenterX = GAME_WIDTH * 0.5;
        const viewCenterY = GAME_HEIGHT * 0.5;
        const playerCenterX = this.player.position.x + this.player.width * 0.5;
        const playerCenterY = this.player.position.y + this.player.height * 0.5;
        const targetX = -playerCenterX + viewCenterX;
        const targetY = -playerCenterY + viewCenterY;
        const clamped = this.clampCamera(targetX, targetY);

        this.world.x += (clamped.x - this.world.x) * 0.08;
        this.world.y += (clamped.y - this.world.y) * 0.08;

        this.visuals?.update(this.world.x, this.world.y, GAME_WIDTH, GAME_HEIGHT);
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

    this.virtualInput?.reset();

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

    if (this.gameRoot) {
      this.gameRoot.removeFromParent();
      this.gameRoot.destroy({ children: false });
      this.gameRoot = null;
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

    this.keyboardInput = { moveX: 0, jumpDown: false, jumpHeld: false };
    this.inputState = { move: 0, jump: false };

    if (this.isPlaytest) {
      LevelSession.clearPreviewLevel();
      this.isPlaytest = false;
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

    const minX = GAME_WIDTH - this.worldBounds.maxX;
    const maxX = -this.worldBounds.minX;
    const minY = GAME_HEIGHT - this.worldBounds.maxY;
    const maxY = -this.worldBounds.minY;

    return {
      x: Math.min(Math.max(targetX, minX), maxX),
      y: Math.min(Math.max(targetY, minY), maxY),
    };
  }

  private centerCameraOnPlayer() {
    if (!this.world || !this.player) {
      return;
    }
    const viewCenterX = GAME_WIDTH * 0.5;
    const viewCenterY = GAME_HEIGHT * 0.5;
    const playerCenterX = this.player.position.x + this.player.width * 0.5;
    const playerCenterY = this.player.position.y + this.player.height * 0.5;
    const targetX = -playerCenterX + viewCenterX;
    const targetY = -playerCenterY + viewCenterY;
    const clamped = this.clampCamera(targetX, targetY);
    this.world.x = clamped.x;
    this.world.y = clamped.y;
    this.visuals?.update(this.world.x, this.world.y, GAME_WIDTH, GAME_HEIGHT);
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
      if (this.isPlaytest) {
        this.exitPlaytest();
        return;
      }
      this.onLevelClear?.();
    }
  }

  private exitPlaytest() {
    LevelSession.clearPreviewLevel();
    this.onRequestPlaytestExit?.();
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
