import {
  AnimatedSprite,
  Assets,
  Container,
  type Spritesheet,
  type Texture,
} from "pixi.js";
import { Physics, type Rect } from "../systems/Physics";

type PlayerInput = {
  move: number;
  jump: boolean;
};

export class Player {
  private readonly container = new Container();
  private sprite: AnimatedSprite | null = null;
  private animations: Record<string, Texture[]> = {};
  private currentAnimation: "idle" | "walk" | "run" | null = null;
  private assetsReady = false;
  private readonly scale: number;
  private readonly baseScale = 144 / 1024;
  private readonly footOffset = 14;
  private facing = 1;

  readonly width: number;
  readonly height: number;

  position = { x: 0, y: 0 };
  velocity = { x: 0, y: 0 };
  grounded = false;

  private readonly moveSpeed: number;
  private readonly jumpSpeed: number;
  private readonly gravity: number;
  private readonly maxFallSpeed: number;

  constructor(startX = 120, startY = 360, scale = 1) {
    this.scale = scale;
    this.width = 48 * this.scale;
    this.height = 96 * this.scale;
    this.moveSpeed = 240 * this.scale;
    this.jumpSpeed = 520 * this.scale;
    this.gravity = 1100 * this.scale;
    this.maxFallSpeed = 800 * this.scale;

    this.position.x = startX * this.scale;
    this.position.y = startY * this.scale;
  }

  mount(stage: Container) {
    stage.addChild(this.container);
    this.syncVisual();
  }

  destroy() {
    this.sprite?.removeFromParent();
    this.sprite?.destroy();
    this.sprite = null;
    this.container.removeFromParent();
    this.container.destroy({ children: true });
    this.animations = {};
    this.currentAnimation = null;
    this.assetsReady = false;
  }

  async loadAssets() {
    if (this.assetsReady) {
      return;
    }

    const basePath = "/ProjectContent/Characters/knight";
    this.animations.idle = await this.loadFrames(basePath, "knight_idle");
    this.animations.walk = await this.loadFrames(basePath, "knight_walking");
    this.animations.run = await this.loadFrames(basePath, "knight_running");

    this.assetsReady = true;
    this.setAnimation("idle");
  }

  update(deltaSeconds: number, input: PlayerInput, solids: Rect[]) {
    const move = Math.max(-1, Math.min(1, input.move));
    this.velocity.x = move * this.moveSpeed;

    if (this.grounded && input.jump) {
      this.velocity.y = -this.jumpSpeed;
      this.grounded = false;
    }

    this.velocity.y = Math.min(
      this.velocity.y + this.gravity * deltaSeconds,
      this.maxFallSpeed,
    );

    const rect = this.getRect();
    const safeDelta = deltaSeconds > 0 ? deltaSeconds : 1 / 60;
    const resolved = Physics.resolve(
      rect,
      { x: this.velocity.x * safeDelta, y: this.velocity.y * safeDelta },
      solids,
    );

    this.position.x = resolved.x;
    this.position.y = resolved.y;
    this.velocity.x = resolved.vx / safeDelta;
    this.velocity.y = resolved.vy / safeDelta;
    this.grounded = resolved.grounded;

    this.updateAnimation(input.move);
    this.syncVisual();
  }

  getRect(): Rect {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.width,
      height: this.height,
    };
  }

  private syncVisual() {
    this.container.x = this.position.x + this.width * 0.5;
    this.container.y =
      this.position.y + this.height + this.footOffset * this.scale;
  }

  private updateAnimation(moveInput: number) {
    if (!this.assetsReady) {
      return;
    }

    const moving = Math.abs(moveInput) > 0.1;
    if (moveInput < -0.1) {
      this.facing = -1;
    } else if (moveInput > 0.1) {
      this.facing = 1;
    }
    const target = this.grounded
      ? moving
        ? this.getMoveAnimation()
        : "idle"
      : "idle";

    this.setAnimation(target);

    if (this.sprite) {
      this.sprite.scale.set(
        this.baseScale * this.scale * this.facing,
        this.baseScale * this.scale,
      );
    }
  }

  private getMoveAnimation(): "walk" | "run" | "idle" {
    if (this.animations.run?.length) {
      return "run";
    }

    if (this.animations.walk?.length) {
      return "walk";
    }

    return "idle";
  }

  private setAnimation(name: "idle" | "walk" | "run") {
    if (this.currentAnimation === name) {
      return;
    }

    const frames = this.animations[name];
    if (!frames || frames.length === 0) {
      return;
    }

    this.currentAnimation = name;
    this.sprite?.removeFromParent();
    this.sprite?.destroy();

    const sprite = new AnimatedSprite(frames);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(
      this.baseScale * this.scale * this.facing,
      this.baseScale * this.scale,
    );
    sprite.animationSpeed = 0.24;
    sprite.play();
    sprite.position.set(0, 0);

    this.sprite = sprite;
    this.container.addChild(sprite);
  }

  private async loadFrames(basePath: string, fileBase: string) {
    const jsonPath = `${basePath}/${fileBase}.json`;
    try {
      const sheet = (await Assets.load(jsonPath)) as Spritesheet;
      const frames = this.extractFrames(sheet);
      if (frames.length > 0) {
        return frames;
      }
    } catch {
      // Fallback to single texture if spritesheet JSON is missing.
    }

    const texture = (await Assets.load(
      `${basePath}/${fileBase}.png`,
    )) as Texture;
    return [texture];
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
}
