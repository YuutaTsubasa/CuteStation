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
  attack: boolean;
};

export class Player {
  private readonly container = new Container();
  private sprite: AnimatedSprite | null = null;
  private animations: Record<string, Texture[]> = {};
  private jumpFrames: {
    jumpUp: Texture[];
    hold: Texture[];
    fall: Texture[];
    land: Texture[];
  } | null = null;
  private currentAnimation:
    | "idle"
    | "walk"
    | "run"
    | "jumpUp"
    | "jumpHold"
    | "jumpFall"
    | "jumpLand"
    | null = null;
  private assetsReady = false;
  private readonly scale: number;
  private readonly baseScale = 144 / 1024;
  private readonly footOffset = 14;
  private facing = 1;
  private jumpPhase: "none" | "jumpUp" | "hold" | "fall" | "land" = "none";
  private readonly fallEps = 5;
  private attackState: "idle" | "attack" | "homing" = "idle";
  private attackActiveTimer = 0;
  private attackCooldownTimer = 0;
  private attackSequence = 0;
  private readonly attackDuration = 0.2;
  private readonly attackCooldown = 0.3;
  private readonly homingDuration = 0.28;
  private readonly homingCooldown = 0.4;

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
    const jumpSegments = await this.loadJumpSegments(basePath, "knight_jumping");
    this.jumpFrames = jumpSegments;

    this.assetsReady = true;
    this.playAnimation("idle", this.animations.idle, { loop: true });
  }

  update(deltaSeconds: number, input: PlayerInput, solids: Rect[]) {
    const wasGrounded = this.grounded;
    const move = Math.max(-1, Math.min(1, input.move));
    this.velocity.x = move * this.moveSpeed;

    this.updateAttackTimers(deltaSeconds, input.attack);

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

    this.updateAnimation(input.move, wasGrounded);
    this.syncVisual();
  }

  clampToBounds(bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
    const maxX = bounds.maxX - this.width;
    const maxY = bounds.maxY - this.height;
    let clampedX = Math.min(Math.max(this.position.x, bounds.minX), maxX);
    let clampedY = Math.min(Math.max(this.position.y, bounds.minY), maxY);

    if (clampedX !== this.position.x) {
      this.position.x = clampedX;
      this.velocity.x = 0;
    }

    if (clampedY !== this.position.y) {
      this.position.y = clampedY;
      if (this.velocity.y > 0) {
        this.velocity.y = 0;
      }
    }

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

  isAttackActive() {
    return this.attackState !== "idle";
  }

  getAttackState() {
    return this.attackState;
  }

  getAttackSequence() {
    return this.attackSequence;
  }

  getFacingDirection() {
    return this.facing;
  }

  setFacingDirection(direction: number) {
    this.facing = direction >= 0 ? 1 : -1;
    this.applyFacing();
  }

  getHomingBounceSpeed() {
    return this.jumpSpeed * 0.7;
  }

  updateAttackTimers(deltaSeconds: number, pressed: boolean) {
    if (this.attackActiveTimer > 0) {
      this.attackActiveTimer = Math.max(0, this.attackActiveTimer - deltaSeconds);
      if (this.attackActiveTimer === 0 && this.attackState !== "idle") {
        this.attackState = "idle";
      }
    }

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - deltaSeconds);
    }

    if (!pressed || this.attackCooldownTimer > 0 || this.attackActiveTimer > 0) {
      return;
    }

    const nextState = this.grounded ? "attack" : "homing";
    this.attackState = nextState;
    this.attackActiveTimer =
      nextState === "homing" ? this.homingDuration : this.attackDuration;
    this.attackCooldownTimer =
      nextState === "homing" ? this.homingCooldown : this.attackCooldown;
    this.attackSequence += 1;
  }

  private syncVisual() {
    this.container.x = this.position.x + this.width * 0.5;
    this.container.y =
      this.position.y + this.height + this.footOffset * this.scale;
  }

  private updateAnimation(moveInput: number, wasGrounded: boolean) {
    if (!this.assetsReady) {
      return;
    }

    const moving = Math.abs(moveInput) > 0.1;
    if (moveInput < -0.1) {
      this.facing = -1;
    } else if (moveInput > 0.1) {
      this.facing = 1;
    }

    if (this.jumpFrames) {
      if (wasGrounded && !this.grounded && this.velocity.y < 0) {
        this.jumpPhase = "jumpUp";
        this.playAnimation("jumpUp", this.jumpFrames.jumpUp, {
          loop: false,
          onComplete: () => {
            this.jumpPhase = "hold";
            this.playAnimation("jumpHold", this.jumpFrames?.hold ?? [], {
              loop: false,
            });
          },
        });
      } else if (!wasGrounded && this.grounded) {
        this.jumpPhase = "land";
        this.playAnimation("jumpLand", this.jumpFrames.land, {
          loop: false,
          onComplete: () => {
            this.jumpPhase = "none";
            this.playGroundedAnimation(moving);
          },
        });
      } else if (!this.grounded && this.velocity.y > this.fallEps) {
        if (this.jumpPhase !== "fall" && this.jumpPhase !== "land") {
          this.jumpPhase = "fall";
          this.playAnimation("jumpFall", this.jumpFrames.fall, {
            loop: false,
            holdLastFrame: true,
          });
        }
      } else if (!this.grounded && this.jumpPhase === "hold") {
        this.playAnimation("jumpHold", this.jumpFrames.hold, { loop: false });
      }
    }

    if (this.grounded) {
      if (this.jumpPhase === "land" && moving) {
        this.jumpPhase = "none";
        this.playGroundedAnimation(moving);
      } else if (this.jumpPhase === "none") {
        this.playGroundedAnimation(moving);
      }
    }

    this.applyFacing();
  }

  private playGroundedAnimation(moving: boolean) {
    const target = moving ? this.getMoveAnimation() : "idle";
    const frames = this.animations[target];
    this.jumpPhase = "none";
    this.playAnimation(target, frames, { loop: true });
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

  private playAnimation(
    name:
      | "idle"
      | "walk"
      | "run"
      | "jumpUp"
      | "jumpHold"
      | "jumpFall"
      | "jumpLand",
    frames: Texture[],
    options: {
      loop: boolean;
      onComplete?: () => void;
      holdLastFrame?: boolean;
    },
  ) {
    if (this.currentAnimation === name) {
      return;
    }

    if (!frames || frames.length === 0) {
      return;
    }

    this.currentAnimation = name;
    this.sprite?.removeFromParent();
    this.sprite?.destroy();

    const sprite = new AnimatedSprite(frames);
    sprite.anchor.set(0.5, 1);
    sprite.animationSpeed = 0.24;
    sprite.loop = options.loop;
    if (frames.length === 1) {
      sprite.gotoAndStop(0);
    } else if (options.loop) {
      sprite.play();
    } else {
      sprite.play();
      if (options.holdLastFrame) {
        sprite.onComplete = () => {
          sprite.gotoAndStop(frames.length - 1);
          options.onComplete?.();
        };
      } else if (options.onComplete) {
        sprite.onComplete = options.onComplete;
      }
    }
    sprite.position.set(0, 0);

    this.sprite = sprite;
    this.container.addChild(sprite);
    this.applyFacing();
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

  private async loadJumpSegments(basePath: string, fileBase: string) {
    const jsonPath = `${basePath}/${fileBase}.json`;
    try {
      const sheet = (await Assets.load(jsonPath)) as Spritesheet;
      const animations = sheet.animations;
      const jumpUp = animations?.jumpUp ?? animations?.JumpUp;
      const jumpHold = animations?.jumpHold ?? animations?.JumpHold;
      const jumpFall = animations?.jumpFall ?? animations?.JumpFall;
      const jumpLand = animations?.jumpLand ?? animations?.JumpLand;

      if (jumpUp && jumpHold && jumpFall && jumpLand) {
        return {
          jumpUp,
          hold: jumpHold,
          fall: jumpFall,
          land: jumpLand,
        };
      }
    } catch {
      return null;
    }

    return null;
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

  private applyFacing() {
    if (this.sprite) {
      this.sprite.scale.set(
        this.baseScale * this.scale * this.facing,
        this.baseScale * this.scale,
      );
    }
  }
}
