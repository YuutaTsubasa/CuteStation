import { Application, Container, Graphics, Rectangle } from "pixi.js";
import { audioManager } from "../game/audio/AudioManager";
import { loadLevel, type LevelPoint, type LevelRect } from "../game/levels/LevelLoader";
import { LevelRuntime } from "../game/levels/LevelRuntime";
import { GAME_HEIGHT, GAME_WIDTH } from "../game/view/ResolutionManager";
import { Page } from "./Page";

type Selection =
  | { type: "spawn" }
  | { type: "solid"; index: number }
  | { type: "coin"; id: string }
  | { type: "goal" }
  | { type: "none" };

type DragState = {
  type: "spawn" | "solid" | "coin" | "goal";
  offsetX: number;
  offsetY: number;
  startRect?: { x: number; y: number; w: number; h: number };
  resizing: boolean;
} | null;

export class LevelEditorPage extends Page {
  private readonly worldScale = 4;
  private readonly baseFloorY = 260;
  private readonly worldPadding = { top: 320, right: 0, bottom: 0, left: 0 };
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private gameRoot: Container | null = null;
  private screenUiLayer: Container | null = null;
  private world: Container | null = null;
  private runtime: LevelRuntime | null = null;
  private selection: Selection = { type: "none" };
  private dragState: DragState = null;
  private lastPointerWorld = { x: 0, y: 0 };
  private panState:
    | { startX: number; startY: number; worldX: number; worldY: number }
    | null = null;
  private gridGraphics: Graphics | null = null;
  private gridSize = 16;
  private gridVisible = true;
  private snapEnabled = true;
  private onRequestExit: (() => void) | null = null;
  private pointerMoveHandler: ((event: PointerEvent) => void) | null = null;
  private pointerUpHandler: (() => void) | null = null;
  private keyDownHandler: ((event: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((event: KeyboardEvent) => void) | null = null;
  private spaceDown = false;
  private enterToken = 0;

  constructor() {
    super("LevelEditor");
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

    audioManager.stopBgm({ fadeOutMs: 300 });

    this.enterToken += 1;
    const token = this.enterToken;

    const app = new Application();
    await app.init({ background: "#101010", width: GAME_WIDTH, height: GAME_HEIGHT });
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
      this.screenUiLayer = null;
    };

    const gameRoot = new Container();
    const screenUiLayer = new Container();
    app.stage.addChild(gameRoot);
    app.stage.addChild(screenUiLayer);
    app.stage.hitArea = new Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.gameRoot = gameRoot;
    this.screenUiLayer = screenUiLayer;

    const level = await loadLevel("/ProjectContent/Levels/whitePalace/1-1.json");
    if (token !== this.enterToken) {
      abort();
      return;
    }

    const world = new Container();
    gameRoot.addChild(world);

    const runtime = new LevelRuntime(level, {
      worldScale: this.worldScale,
      baseFloorY: this.baseFloorY,
      worldPadding: this.worldPadding,
      showSolids: true,
      showCoins: true,
      showGoal: true,
      showSpawn: true,
      showWorldBounds: true,
    });
    runtime.attach(world);
    this.gridVisible = true;
    this.drawGrid();
    window.requestAnimationFrame(() => this.drawGrid());

    app.stage.eventMode = "static";
    app.stage.hitArea = new Rectangle(0, 0, app.renderer.width, app.renderer.height);

    app.stage.on("pointerdown", (event) => {
      const worldPoint = this.getWorldPoint(event.global.x, event.global.y);
      this.lastPointerWorld = worldPoint;
      if (event.button === 2 || this.spaceDown) {
        if (this.world) {
          this.panState = {
            startX: event.global.x,
            startY: event.global.y,
            worldX: this.world.x,
            worldY: this.world.y,
          };
        }
        return;
      }
      this.handlePointerDown(worldPoint, event.shiftKey);
    });

    this.pointerMoveHandler = (event) => {
      if (!this.app) {
        return;
      }
      const rect = this.app.canvas.getBoundingClientRect();
      const scaleX = GAME_WIDTH / rect.width;
      const scaleY = GAME_HEIGHT / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      const worldPoint = this.getWorldPoint(x, y);
      this.lastPointerWorld = worldPoint;
      if (this.panState && this.world) {
        const dx = x - this.panState.startX;
        const dy = y - this.panState.startY;
        const nextX = this.panState.worldX + dx;
        const nextY = this.panState.worldY + dy;
        const clamped = this.clampWorldPosition(nextX, nextY);
        this.world.x = clamped.x;
        this.world.y = clamped.y;
        return;
      }
      this.handlePointerMove(worldPoint, event.shiftKey);
    };

    this.pointerUpHandler = () => {
      this.dragState = null;
      this.panState = null;
    };

    this.keyDownHandler = (event) => {
      if (event.key === "Escape") {
        this.onRequestExit?.();
      }
      if (event.key === " ") {
        this.spaceDown = true;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        this.deleteSelected();
      }
    };
    this.keyUpHandler = (event) => {
      if (event.key === " ") {
        this.spaceDown = false;
      }
    };

    window.addEventListener("pointermove", this.pointerMoveHandler);
    window.addEventListener("pointerup", this.pointerUpHandler);
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
    window.addEventListener("contextmenu", this.preventContextMenu, true);

    this.app = app;
    this.world = world;
    this.runtime = runtime;
  }

  override onExit() {
    this.enterToken += 1;

    if (this.pointerMoveHandler) {
      window.removeEventListener("pointermove", this.pointerMoveHandler);
      this.pointerMoveHandler = null;
    }

    if (this.pointerUpHandler) {
      window.removeEventListener("pointerup", this.pointerUpHandler);
      this.pointerUpHandler = null;
    }

    if (this.keyDownHandler) {
      window.removeEventListener("keydown", this.keyDownHandler);
      this.keyDownHandler = null;
    }
    if (this.keyUpHandler) {
      window.removeEventListener("keyup", this.keyUpHandler);
      this.keyUpHandler = null;
    }
    window.removeEventListener("contextmenu", this.preventContextMenu, true);

    this.dragState = null;
    this.panState = null;
    this.selection = { type: "none" };
    this.spaceDown = false;
    this.gridGraphics?.destroy();
    this.gridGraphics = null;

    if (this.runtime) {
      this.runtime.destroy();
      this.runtime = null;
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
    this.screenUiLayer = null;

    if (this.app) {
      const canvas = this.app.canvas;
      this.app.destroy(true);
      this.app = null;
      canvas.remove();
    }

    super.onExit();
  }

  addSolid() {
    if (!this.runtime) {
      return;
    }

    const point = this.runtime.toLevelPoint(this.lastPointerWorld);
    const rect: LevelRect = {
      x: point.x - 80,
      y: point.y - 12,
      w: 160,
      h: 24,
    };
    const index = this.runtime.addSolid(rect);
    this.selection = { type: "solid", index };
  }

  addCoin() {
    if (!this.runtime) {
      return;
    }

    const point = this.runtime.toLevelPoint(this.lastPointerWorld);
    const id = `coin-${Date.now()}`;
    const coin: LevelPoint = { id, x: point.x, y: point.y };
    this.runtime.addCoin(coin);
    this.selection = { type: "coin", id };
  }

  deleteSelected() {
    if (!this.runtime) {
      return;
    }

    if (this.selection.type === "solid") {
      this.runtime.removeSolid(this.selection.index);
      this.selection = { type: "none" };
      return;
    }

    if (this.selection.type === "coin") {
      this.runtime.removeCoin(this.selection.id);
      this.selection = { type: "none" };
    }
  }

  async exportLevel() {
    if (!this.runtime) {
      return;
    }

    const payload = JSON.stringify(this.runtime.getLevelData(), null, 2);
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      console.log(payload);
    }
  }

  resizeWorld(deltaWidth: number, deltaHeight: number) {
    if (!this.runtime) {
      return;
    }
    const current = this.runtime.getLevelData().world;
    const width = Math.max(200, current.width + deltaWidth);
    const height = Math.max(200, current.height + deltaHeight);
    this.runtime.updateWorldSize(width, height);
    this.drawGrid();
  }

  toggleGrid() {
    this.gridVisible = !this.gridVisible;
    this.drawGrid();
    return this.gridVisible;
  }

  toggleSnap() {
    this.snapEnabled = !this.snapEnabled;
    return this.snapEnabled;
  }

  private handlePointerDown(worldPoint: { x: number; y: number }, resizing: boolean) {
    if (!this.runtime) {
      return;
    }

    const spawnWorld = this.runtime.toWorldPoint(this.runtime.level.spawn);
    const spawnDistance = this.distance(worldPoint, spawnWorld);
    if (spawnDistance < 20 * this.worldScale) {
      this.selection = { type: "spawn" };
      this.dragState = {
        type: "spawn",
        offsetX: 0,
        offsetY: 0,
        resizing: false,
      };
      return;
    }

    for (const coin of this.runtime.level.coins) {
      const coinWorld = this.runtime.toWorldPoint(coin);
      if (this.distance(worldPoint, coinWorld) < 18 * this.worldScale) {
        this.selection = { type: "coin", id: coin.id };
        this.dragState = {
          type: "coin",
          offsetX: 0,
          offsetY: 0,
          resizing: false,
        };
        return;
      }
    }

    const goalWorld = this.runtime.getGoalWorld();
    if (goalWorld && this.pointInRect(worldPoint, goalWorld)) {
      this.selection = { type: "goal" };
      this.dragState = {
        type: "goal",
        offsetX: worldPoint.x - goalWorld.x,
        offsetY: worldPoint.y - goalWorld.y,
        startRect: { x: goalWorld.x, y: goalWorld.y, w: goalWorld.width, h: goalWorld.height },
        resizing,
      };
      return;
    }

    const solidsWorld = this.runtime.getSolidsWorld();
    for (let i = 0; i < solidsWorld.length; i += 1) {
      const solid = solidsWorld[i];
      if (this.pointInRect(worldPoint, solid)) {
        this.selection = { type: "solid", index: i };
        this.dragState = {
          type: "solid",
          offsetX: worldPoint.x - solid.x,
          offsetY: worldPoint.y - solid.y,
          startRect: { x: solid.x, y: solid.y, w: solid.width, h: solid.height },
          resizing,
        };
        return;
      }
    }

    this.selection = { type: "none" };
    this.dragState = null;
  }

  private handlePointerMove(worldPoint: { x: number; y: number }, resizing: boolean) {
    if (!this.runtime || !this.dragState) {
      return;
    }

    const drag = this.dragState;
    if (drag.type === "spawn") {
      const levelPoint = this.snapPoint(this.runtime.toLevelPoint(worldPoint));
      this.runtime.updateSpawn(levelPoint);
      return;
    }

    if (drag.type === "coin") {
      if (this.selection.type !== "coin") {
        return;
      }
      const levelPoint = this.snapPoint(this.runtime.toLevelPoint(worldPoint));
      this.runtime.updateCoin(this.selection.id, { id: this.selection.id, ...levelPoint });
      return;
    }

    if (drag.type === "goal") {
      if (!drag.startRect) {
        return;
      }
      if (resizing) {
        const newRect = {
          x: drag.startRect.x,
          y: drag.startRect.y,
          w: Math.max(20, worldPoint.x - drag.startRect.x),
          h: Math.max(20, worldPoint.y - drag.startRect.y),
        };
        this.runtime.updateGoal(
          this.snapRect(
            this.runtime.toLevelRect({
              x: newRect.x,
              y: newRect.y,
              width: newRect.w,
              height: newRect.h,
            }),
          ),
        );
      } else {
        const nextWorld = {
          x: worldPoint.x - drag.offsetX,
          y: worldPoint.y - drag.offsetY,
          w: drag.startRect.w,
          h: drag.startRect.h,
        };
        this.runtime.updateGoal(
          this.snapRect(
            this.runtime.toLevelRect({
              x: nextWorld.x,
              y: nextWorld.y,
              width: nextWorld.w,
              height: nextWorld.h,
            }),
          ),
        );
      }
      return;
    }

    if (drag.type === "solid") {
      if (this.selection.type !== "solid" || !drag.startRect) {
        return;
      }
      if (resizing) {
        const newRect = {
          x: drag.startRect.x,
          y: drag.startRect.y,
          w: Math.max(20, worldPoint.x - drag.startRect.x),
          h: Math.max(12, worldPoint.y - drag.startRect.y),
        };
        this.runtime.updateSolid(
          this.selection.index,
          this.snapRect(
            this.runtime.toLevelRect({
              x: newRect.x,
              y: newRect.y,
              width: newRect.w,
              height: newRect.h,
            }),
          ),
        );
      } else {
        const nextWorld = {
          x: worldPoint.x - drag.offsetX,
          y: worldPoint.y - drag.offsetY,
          w: drag.startRect.w,
          h: drag.startRect.h,
        };
        this.runtime.updateSolid(
          this.selection.index,
          this.snapRect(
            this.runtime.toLevelRect({
              x: nextWorld.x,
              y: nextWorld.y,
              width: nextWorld.w,
              height: nextWorld.h,
            }),
          ),
        );
      }
    }
  }

  private getWorldPoint(x: number, y: number) {
    if (!this.world) {
      return { x, y };
    }
    return { x: x - this.world.x, y: y - this.world.y };
  }

  private clampWorldPosition(x: number, y: number) {
    if (!this.app || !this.runtime) {
      return { x, y };
    }
    const bounds = this.runtime.getWorldBounds();
    if (!bounds) {
      return { x, y };
    }
    const minX = GAME_WIDTH - bounds.maxX;
    const maxX = -bounds.minX;
    const minY = GAME_HEIGHT - bounds.maxY;
    const maxY = -bounds.minY;
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }

  private preventContextMenu = (event: Event) => {
    if (!this.app) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.app.canvas.contains(target)) {
      event.preventDefault();
    }
  };

  private pointInRect(point: { x: number; y: number }, rect: Rect) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  private distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }


  private snapValue(value: number) {
    if (!this.snapEnabled) {
      return value;
    }
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  private snapPoint(point: { x: number; y: number }) {
    if (!this.snapEnabled) {
      return point;
    }
    return {
      x: this.snapValue(point.x),
      y: this.snapValue(point.y),
    };
  }

  private snapRect(rect: { x: number; y: number; w: number; h: number }) {
    if (!this.snapEnabled) {
      return rect;
    }
    return {
      x: this.snapValue(rect.x),
      y: this.snapValue(rect.y),
      w: Math.max(20, this.snapValue(rect.w)),
      h: Math.max(12, this.snapValue(rect.h)),
    };
  }

  private drawGrid() {
    if (!this.runtime || !this.world) {
      return;
    }

    if (this.gridGraphics) {
      this.gridGraphics.destroy();
      this.gridGraphics = null;
    }

    if (!this.gridVisible) {
      return;
    }

    const rect = this.runtime.getWorldRect();
    if (!rect) {
      return;
    }

    const gridSize = this.gridSize * this.worldScale;
    const gfx = new Graphics();
    const startX = rect.x;
    const endX = rect.x + rect.width;
    const startY = rect.y;
    const endY = rect.y + rect.height;

    for (let x = startX, i = 0; x <= endX; x += gridSize, i += 1) {
      const color = i % 4 === 0 ? 0xb0b0b0 : 0x7a7a7a;
      const alpha = i % 4 === 0 ? 0.85 : 0.6;
      gfx.moveTo(x, startY).lineTo(x, endY).stroke({ color, width: 1, alpha });
    }
    for (let y = startY, i = 0; y <= endY; y += gridSize, i += 1) {
      const color = i % 4 === 0 ? 0xb0b0b0 : 0x7a7a7a;
      const alpha = i % 4 === 0 ? 0.85 : 0.6;
      gfx.moveTo(startX, y).lineTo(endX, y).stroke({ color, width: 1, alpha });
    }

    this.world.addChildAt(gfx, 0);
    this.gridGraphics = gfx;
  }
}
