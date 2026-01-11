import type { LevelPoint } from "../levels/LevelLoader";
import type { LevelRuntime } from "../levels/LevelRuntime";
import type { Rect } from "../systems/Physics";

type CollectibleOptions = {
  worldScale: number;
  // Radius is in level units (pre-scale) to match JSON coordinates.
  pickupRadius?: number;
  onCollect?: (count: number, total: number) => void;
};

export class Collectible {
  private readonly runtime: LevelRuntime;
  private readonly worldScale: number;
  private readonly pickupRadius: number;
  private readonly collected = new Set<string>();
  private coins: LevelPoint[] = [];
  private onCollect: ((count: number, total: number) => void) | null = null;
  private audioContext: AudioContext | null = null;
  private lastPickupAt = 0;

  constructor(runtime: LevelRuntime, options: CollectibleOptions) {
    this.runtime = runtime;
    this.worldScale = options.worldScale;
    this.pickupRadius = options.pickupRadius ?? 16;
    this.onCollect = options.onCollect ?? null;
  }

  setCoins(coins: LevelPoint[]) {
    this.coins = coins;
    this.collected.clear();
    this.onCollect?.(0, this.coins.length);
  }

  getCollectedCount() {
    return this.collected.size;
  }

  getTotalCount() {
    return this.coins.length;
  }

  hasCollectedAll() {
    return this.collected.size >= this.coins.length;
  }

  collectAlongSegment(
    start: { x: number; y: number },
    end: { x: number; y: number },
    halfThickness: number,
  ) {
    if (this.coins.length === 0) {
      return;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.001) {
      return;
    }

    const invLength = 1 / length;
    const dirX = dx * invLength;
    const dirY = dy * invLength;
    const perpX = -dirY;
    const perpY = dirX;
    const radius = this.pickupRadius * this.worldScale;
    const thickness = halfThickness + radius;

    for (const coin of this.coins) {
      if (this.collected.has(coin.id)) {
        continue;
      }

      const worldPoint = this.runtime.toWorldPoint(coin);
      const vx = worldPoint.x - start.x;
      const vy = worldPoint.y - start.y;
      const along = vx * dirX + vy * dirY;
      if (along < -radius || along > length + radius) {
        continue;
      }
      const across = vx * perpX + vy * perpY;
      if (Math.abs(across) > thickness) {
        continue;
      }

      this.collected.add(coin.id);
      this.runtime.collectCoin(coin.id);
      this.playPickupSound();
      this.onCollect?.(this.collected.size, this.coins.length);
    }
  }

  update(playerRect: Rect) {
    if (this.coins.length === 0) {
      return;
    }

    const radius = this.pickupRadius * this.worldScale;
    for (const coin of this.coins) {
      if (this.collected.has(coin.id)) {
        continue;
      }

      const worldPoint = this.runtime.toWorldPoint(coin);
      const hit = this.rectCircleOverlap(
        playerRect,
        { x: worldPoint.x, y: worldPoint.y, r: radius },
      );

      if (hit) {
        this.collected.add(coin.id);
        this.runtime.collectCoin(coin.id);
        this.playPickupSound();
        this.onCollect?.(this.collected.size, this.coins.length);
      }
    }
  }

  destroy() {
    this.onCollect = null;
    this.coins = [];
    this.collected.clear();
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
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

  private playPickupSound() {
    const now = performance.now();
    if (now - this.lastPickupAt < 120) {
      return;
    }
    this.lastPickupAt = now;

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    const context = this.audioContext;
    if (context.state === "suspended") {
      void context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(720, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      1240,
      context.currentTime + 0.08,
    );
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  }
}
