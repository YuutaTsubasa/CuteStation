import {
  AnimatedSprite,
  Assets,
  Container,
  Graphics,
  type Spritesheet,
  type Texture,
} from "pixi.js";
import type { LevelData, LevelEnemy, LevelPoint, LevelRect } from "./LevelLoader";
import type { Rect } from "../systems/Physics";
import { assetManifest, getSpriteSheetPaths } from "../assets/AssetManifest";

export type LevelRuntimeOptions = {
  worldScale: number;
  baseFloorY?: number;
  worldPadding?: { top: number; right: number; bottom: number; left: number };
  showSolids?: boolean;
  showCoins?: boolean;
  showGoal?: boolean;
  showSpawn?: boolean;
  showWorldBounds?: boolean;
  showEnemies?: boolean;
};

type WorldBounds = { minX: number; minY: number; maxX: number; maxY: number };

type Point = { x: number; y: number };

type RectLike = { x: number; y: number; w: number; h: number };

export class LevelRuntime {
  readonly level: LevelData;
  readonly worldScale: number;
  readonly worldOffsetY: number;
  private readonly worldPadding: { top: number; right: number; bottom: number; left: number };
  private readonly showSolids: boolean;
  private readonly showCoins: boolean;
  private readonly showGoal: boolean;
  private readonly showSpawn: boolean;
  private readonly showWorldBounds: boolean;
  private readonly showEnemies: boolean;

  private world: Container | null = null;
  private solidsWorld: Rect[] = [];
  private solidGraphics: Graphics[] = [];
  private coinGraphics = new Map<string, Graphics | AnimatedSprite>();
  private coinFrames: Texture[] | null = null;
  private readonly coinAnimationSpeed = 0.18;
  private goalGraphic: Graphics | null = null;
  private spawnGraphic: Graphics | null = null;
  private worldBoundsGraphic: Graphics | null = null;
  private worldBounds: WorldBounds | null = null;
  private enemiesWorld: Point[] = [];
  private enemyGraphics: Graphics[] = [];

  constructor(level: LevelData, options: LevelRuntimeOptions) {
    this.level = level;
    this.worldScale = options.worldScale;
    this.worldPadding = options.worldPadding ?? {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };
    this.showSolids = options.showSolids ?? true;
    this.showCoins = options.showCoins ?? true;
    this.showGoal = options.showGoal ?? true;
    this.showSpawn = options.showSpawn ?? false;
    this.showWorldBounds = options.showWorldBounds ?? false;
    this.showEnemies = options.showEnemies ?? false;

    const baseFloorY = options.baseFloorY ?? this.getBaseFloorY(level.solids);
    this.worldOffsetY = baseFloorY * (this.worldScale - 1);
  }

  attach(world: Container) {
    this.world = world;
    this.rebuildWorld();
  }

  destroy() {
    for (const gfx of this.solidGraphics) {
      gfx.destroy();
    }
    this.solidGraphics = [];
    for (const gfx of this.coinGraphics.values()) {
      gfx.destroy();
    }
    this.coinGraphics.clear();
    this.coinFrames = null;
    for (const gfx of this.enemyGraphics) {
      gfx.destroy();
    }
    this.enemyGraphics = [];
    this.enemiesWorld = [];
    this.goalGraphic?.destroy();
    this.goalGraphic = null;
    this.spawnGraphic?.destroy();
    this.spawnGraphic = null;
    this.worldBoundsGraphic?.destroy();
    this.worldBoundsGraphic = null;
    this.solidsWorld = [];
    this.worldBounds = null;
    this.world = null;
  }

  getSolidsWorld() {
    return this.solidsWorld;
  }

  getCoinsWorld() {
    return this.level.coins.map((coin) => this.toWorldPoint(coin));
  }

  getEnemiesWorld() {
    return this.enemiesWorld;
  }

  getGoalWorld() {
    if (!this.level.goal) {
      return null;
    }

    return this.toWorldRect(this.level.goal);
  }

  getWorldBounds() {
    return this.worldBounds;
  }

  getWorldRect() {
    return this.getWorldRectInternal();
  }

  getLevelData() {
    return this.level;
  }

  async loadCoinAssets() {
    if (this.coinFrames) {
      return;
    }

    const sheetPath = assetManifest.items.coin.sheet;
    const { json: jsonPath, image: imagePath } = getSpriteSheetPaths(sheetPath);
    try {
      const sheet = (await Assets.load(jsonPath)) as Spritesheet;
      const frames = this.extractFrames(sheet);
      if (frames.length > 0) {
        this.coinFrames = frames;
        this.rebuildCoins();
        return;
      }
    } catch {
      // Fallback to single texture if spritesheet JSON is missing.
    }

    try {
      const texture = (await Assets.load(imagePath)) as Texture;
      this.coinFrames = [texture];
      this.rebuildCoins();
    } catch {
      // Ignore coin asset failures; fallback visuals stay.
    }
  }

  collectCoin(id: string) {
    const gfx = this.coinGraphics.get(id);
    if (gfx) {
      gfx.visible = false;
    }
  }

  setCoinVisible(id: string, visible: boolean) {
    const gfx = this.coinGraphics.get(id);
    if (gfx) {
      gfx.visible = visible;
    }
  }

  addSolid(rect: LevelRect) {
    this.level.solids.push(rect);
    if (!this.world || !this.showSolids) {
      return this.level.solids.length - 1;
    }

    const worldRect = this.toWorldRect(rect);
    const gfx = this.drawSolid(worldRect);
    this.solidGraphics.push(gfx);
    this.solidsWorld.push(worldRect);
    this.updateWorldBounds();
    return this.level.solids.length - 1;
  }

  updateSolid(index: number, rect: LevelRect) {
    this.level.solids[index] = rect;
    const worldRect = this.toWorldRect(rect);
    this.solidsWorld[index] = worldRect;
    const gfx = this.solidGraphics[index];
    if (gfx) {
      gfx.clear();
      gfx.rect(0, 0, worldRect.width, worldRect.height).fill(0x3c3c3c);
      gfx.x = worldRect.x;
      gfx.y = worldRect.y;
    }
    this.updateWorldBounds();
  }

  removeSolid(index: number) {
    this.level.solids.splice(index, 1);
    const gfx = this.solidGraphics.splice(index, 1)[0];
    if (gfx) {
      gfx.destroy();
    }
    this.solidsWorld.splice(index, 1);
    this.updateWorldBounds();
  }

  addCoin(point: LevelPoint) {
    this.level.coins.push(point);
    if (!this.world || !this.showCoins) {
      return;
    }

    const gfx = this.drawCoin(this.toWorldPoint(point));
    this.coinGraphics.set(point.id, gfx);
  }

  updateCoin(id: string, point: LevelPoint) {
    const index = this.level.coins.findIndex((coin) => coin.id === id);
    if (index === -1) {
      return;
    }

    this.level.coins[index] = point;
    const gfx = this.coinGraphics.get(id);
    if (gfx) {
      const worldPoint = this.toWorldPoint(point);
      gfx.x = worldPoint.x;
      gfx.y = worldPoint.y;
    }
  }

  removeCoin(id: string) {
    this.level.coins = this.level.coins.filter((coin) => coin.id !== id);
    const gfx = this.coinGraphics.get(id);
    if (gfx) {
      gfx.destroy();
    }
    this.coinGraphics.delete(id);
  }

  addEnemy(enemy: LevelEnemy) {
    this.level.enemies = this.level.enemies ?? [];
    this.level.enemies.push(enemy);
    const index = this.level.enemies.length - 1;
    if (!this.world || !this.showEnemies) {
      return index;
    }
    const worldPoint = this.toWorldPoint(enemy);
    const gfx = this.drawEnemy(worldPoint, enemy);
    this.enemyGraphics.push(gfx);
    this.enemiesWorld.push(worldPoint);
    return index;
  }

  updateEnemy(index: number, enemy: LevelEnemy) {
    if (!this.level.enemies) {
      this.level.enemies = [];
    }
    this.level.enemies[index] = enemy;
    const worldPoint = this.toWorldPoint(enemy);
    this.enemiesWorld[index] = worldPoint;
    const gfx = this.enemyGraphics[index];
    if (gfx) {
      const color = this.getEnemyColor(enemy);
      gfx.clear();
      gfx.circle(0, 0, 12 * this.worldScale).fill(color).stroke({
        color: 0xffffff,
        width: 2,
      });
      gfx.x = worldPoint.x;
      gfx.y = worldPoint.y;
    }
  }

  removeEnemy(index: number) {
    if (!this.level.enemies) {
      return;
    }
    this.level.enemies.splice(index, 1);
    const gfx = this.enemyGraphics.splice(index, 1)[0];
    if (gfx) {
      gfx.destroy();
    }
    this.enemiesWorld.splice(index, 1);
  }

  updateGoal(rect: LevelRect) {
    this.level.goal = rect;
    if (this.goalGraphic) {
      const worldRect = this.toWorldRect(rect);
      this.goalGraphic.clear();
      this.goalGraphic
        .rect(0, 0, worldRect.width, worldRect.height)
        .stroke({ color: 0x48d38a, width: 2 });
      this.goalGraphic.x = worldRect.x;
      this.goalGraphic.y = worldRect.y;
    }
  }

  updateSpawn(point: { x: number; y: number }) {
    this.level.spawn = { ...point };
    if (this.spawnGraphic) {
      const worldPoint = this.toWorldPoint(point);
      this.spawnGraphic.x = worldPoint.x;
      this.spawnGraphic.y = worldPoint.y;
    }
  }

  toWorldPoint(point: { x: number; y: number }) {
    return {
      x: point.x * this.worldScale,
      y: point.y * this.worldScale - this.worldOffsetY,
    };
  }

  toLevelPoint(point: Point) {
    return {
      x: point.x / this.worldScale,
      y: (point.y + this.worldOffsetY) / this.worldScale,
    };
  }

  toWorldRect(rect: RectLike): Rect {
    return {
      x: rect.x * this.worldScale,
      y: rect.y * this.worldScale - this.worldOffsetY,
      width: rect.w * this.worldScale,
      height: rect.h * this.worldScale,
    };
  }

  toLevelRect(rect: Rect): LevelRect {
    return {
      x: rect.x / this.worldScale,
      y: (rect.y + this.worldOffsetY) / this.worldScale,
      w: rect.width / this.worldScale,
      h: rect.height / this.worldScale,
    };
  }

  updateWorldSize(width: number, height: number) {
    this.level.world = { width, height };
    if (this.showWorldBounds) {
      if (!this.worldBoundsGraphic) {
        this.worldBoundsGraphic = this.drawWorldBounds();
      } else {
        this.redrawWorldBounds(this.worldBoundsGraphic);
      }
    }
    this.updateWorldBounds();
  }

  private rebuildWorld() {
    if (!this.world) {
      return;
    }

    this.solidsWorld = this.level.solids.map((solid) => this.toWorldRect(solid));
    if (this.showSolids) {
      this.solidGraphics = this.solidsWorld.map((solid) => this.drawSolid(solid));
    }

    if (this.showCoins) {
      for (const coin of this.level.coins) {
        const gfx = this.drawCoin(this.toWorldPoint(coin));
        this.coinGraphics.set(coin.id, gfx);
      }
    }

    if (this.showEnemies && this.level.enemies) {
      this.enemiesWorld = this.level.enemies.map((enemy) => this.toWorldPoint(enemy));
      this.enemyGraphics = this.enemiesWorld.map((enemy, index) =>
        this.drawEnemy(enemy, this.level.enemies?.[index]),
      );
    }

    if (this.showGoal && this.level.goal) {
      this.goalGraphic = this.drawGoal(this.toWorldRect(this.level.goal));
    }

    if (this.showSpawn) {
      this.spawnGraphic = this.drawSpawn(this.toWorldPoint(this.level.spawn));
    }

    if (this.showWorldBounds) {
      this.worldBoundsGraphic = this.drawWorldBounds();
    }

    this.updateWorldBounds();
  }

  private rebuildCoins() {
    for (const gfx of this.coinGraphics.values()) {
      gfx.destroy();
    }
    this.coinGraphics.clear();

    if (!this.world || !this.showCoins) {
      return;
    }

    for (const coin of this.level.coins) {
      const gfx = this.drawCoin(this.toWorldPoint(coin));
      this.coinGraphics.set(coin.id, gfx);
    }
  }

  private updateWorldBounds() {
    const worldRect = this.getWorldRect();
    if (worldRect) {
      this.worldBounds = {
        minX: worldRect.x - this.worldPadding.left,
        minY: worldRect.y - this.worldPadding.top,
        maxX: worldRect.x + worldRect.width + this.worldPadding.right,
        maxY: worldRect.y + worldRect.height + this.worldPadding.bottom,
      };
      return;
    }

    if (this.solidsWorld.length === 0) {
      this.worldBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      return;
    }

    let minX = this.solidsWorld[0].x;
    let minY = this.solidsWorld[0].y;
    let maxX = this.solidsWorld[0].x + this.solidsWorld[0].width;
    let maxY = this.solidsWorld[0].y + this.solidsWorld[0].height;

    for (const solid of this.solidsWorld) {
      minX = Math.min(minX, solid.x);
      minY = Math.min(minY, solid.y);
      maxX = Math.max(maxX, solid.x + solid.width);
      maxY = Math.max(maxY, solid.y + solid.height);
    }

    this.worldBounds = {
      minX: minX - this.worldPadding.left,
      minY: minY - this.worldPadding.top,
      maxX: maxX + this.worldPadding.right,
      maxY: maxY + this.worldPadding.bottom,
    };
  }

  private drawSolid(rect: Rect) {
    const gfx = new Graphics();
    gfx.rect(0, 0, rect.width, rect.height).fill(0x3c3c3c);
    gfx.x = rect.x;
    gfx.y = rect.y;
    this.world?.addChild(gfx);
    return gfx;
  }

  private drawCoin(point: Point) {
    if (this.coinFrames && this.coinFrames.length > 0) {
      const sprite = new AnimatedSprite(this.coinFrames);
      sprite.anchor.set(0.5, 0.5);
      sprite.animationSpeed = this.coinAnimationSpeed;
      sprite.play();

      const texture = this.coinFrames[0];
      const frameSize = texture.orig?.width ?? texture.width;
      const targetSize = 24 * this.worldScale;
      const scale = frameSize > 0 ? targetSize / frameSize : 1;
      sprite.scale.set(scale);

      sprite.x = point.x;
      sprite.y = point.y;
      this.world?.addChild(sprite);
      return sprite;
    }

    const gfx = new Graphics();
    gfx.circle(0, 0, 12 * this.worldScale).fill(0xf5c542);
    gfx.x = point.x;
    gfx.y = point.y;
    this.world?.addChild(gfx);
    return gfx;
  }

  private drawEnemy(point: Point, enemy?: LevelEnemy) {
    const gfx = new Graphics();
    const color = this.getEnemyColor(enemy);
    gfx.circle(0, 0, 12 * this.worldScale).fill(color).stroke({
      color: 0xffffff,
      width: 2,
    });
    gfx.x = point.x;
    gfx.y = point.y;
    this.world?.addChild(gfx);
    return gfx;
  }

  private getEnemyColor(enemy?: LevelEnemy) {
    return enemy?.enemyType === "patrol" ? 0xff6b6b : 0x6bd6ff;
  }

  private extractFrames(sheet: Spritesheet) {
    const animationKeys = Object.keys(sheet.animations);
    if (animationKeys.length > 0) {
      const frames = sheet.animations[animationKeys[0]];
      if (frames) {
        return frames;
      }
    }

    return Object.values(sheet.textures);
  }

  private drawGoal(rect: Rect) {
    const gfx = new Graphics();
    gfx.rect(0, 0, rect.width, rect.height).stroke({ color: 0x48d38a, width: 2 });
    gfx.x = rect.x;
    gfx.y = rect.y;
    this.world?.addChild(gfx);
    return gfx;
  }

  private drawSpawn(point: Point) {
    const size = 16 * this.worldScale;
    const gfx = new Graphics();
    gfx
      .moveTo(-size, 0)
      .lineTo(size, 0)
      .stroke({ color: 0x4aa3ff, width: 2 })
      .moveTo(0, -size)
      .lineTo(0, size)
      .stroke({ color: 0x4aa3ff, width: 2 });
    gfx.x = point.x;
    gfx.y = point.y;
    this.world?.addChild(gfx);
    return gfx;
  }

  private getBaseFloorY(solids: LevelRect[]) {
    if (solids.length === 0) {
      return 0;
    }

    return solids.reduce((maxY, solid) => Math.max(maxY, solid.y + solid.h), 0);
  }

  private getWorldRectInternal() {
    if (!this.level.world) {
      return null;
    }

    return {
      x: 0,
      y: -this.worldOffsetY,
      width: this.level.world.width * this.worldScale,
      height: this.level.world.height * this.worldScale,
    };
  }

  private drawWorldBounds() {
    const rect = this.getWorldRect();
    if (!rect) {
      return new Graphics();
    }
    const gfx = new Graphics();
    gfx
      .rect(0, 0, rect.width, rect.height)
      .stroke({ color: 0x7a7a7a, width: 2 });
    gfx.x = rect.x;
    gfx.y = rect.y;
    this.world?.addChild(gfx);
    return gfx;
  }

  private redrawWorldBounds(gfx: Graphics) {
    const rect = this.getWorldRect();
    if (!rect) {
      return;
    }
    gfx.clear();
    gfx
      .rect(0, 0, rect.width, rect.height)
      .stroke({ color: 0x7a7a7a, width: 2 });
    gfx.x = rect.x;
    gfx.y = rect.y;
  }
}
