import {
  AnimatedSprite,
  Assets,
  Container,
  Sprite,
  type Spritesheet,
  type Texture,
} from "pixi.js";
import { assetManifest, getSpriteSheetPaths } from "../assets/AssetManifest";
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
  private attackHitFrames = new Set<number>();
  private currentAnimation:
    | "idle"
    | "walk"
    | "run"
    | "attack"
    | "runAttack"
    | "hit"
    | "dead"
    | "jumpUp"
    | "jumpHold"
    | "jumpFall"
    | "jumpLand"
    | null = null;
  private assetsReady = false;
  private readonly scale: number;
  private readonly baseScale = 144 / 1024;
  private readonly footOffset = 14;
  private readonly textureScale = 0.5;
  private facing = 1;
  private jumpPhase: "none" | "jumpUp" | "hold" | "fall" | "land" = "none";
  private readonly fallEps = 5;
  private lifeState: "alive" | "hurt" | "dead" = "alive";
  private hurtTimer = 0;
  private hurtDuration = 0;
  private hurtRestartRequested = false;
  private hurtJustEnded = false;
  private deathHoldTimer = 0;
  private readonly deathHoldDuration = 1.5;
  private deathAnimationComplete = false;
  private deathAnimationStarted = false;
  private attackState: "idle" | "attack" | "homing" = "idle";
  private lastAttackType: "attack" | "homing" | null = null;
  private attackActiveTimer = 0;
  private attackCooldownTimer = 0;
  private attackSequence = 0;
  private readonly attackDuration = 0.2;
  private readonly attackCooldown = 0.3;
  private readonly attackVisualDuration = 0.6;
  private readonly attackStartFrame = 8;
  private readonly homingDuration = 0.28;
  private readonly homingCooldown = 0.4;
  private readonly homingVisualDuration = 0.5;
  private readonly homingInvincibility = 0.45;
  private attackJustEnded = false;
  private attackVisualTimer = 0;
  private attackRestartRequested = false;
  private pendingAttackType: "attack" | "homing" | null = null;
  private lastAttackAnimationId = -1;
  private invincibleTimer = 0;
  private flickerTimer = 0;
  private flickerOn = false;
  private readonly flickerInterval = 0.08;
  private invincibleFlicker = false;
  private readonly baseAnimationSpeed = 0.24;
  private readonly animationFps = 60;

  width: number;
  height: number;

  position = { x: 0, y: 0 };
  velocity = { x: 0, y: 0 };
  grounded = false;
  private readonly maxHealth = 3;
  private health = 3;

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
    this.health = this.maxHealth;
    this.lifeState = "alive";
    this.hurtTimer = 0;
    this.hurtDuration = 0;
    this.hurtRestartRequested = false;
    this.hurtJustEnded = false;
    this.deathHoldTimer = 0;
    this.deathAnimationComplete = false;
    this.deathAnimationStarted = false;
    this.lastAttackAnimationId = -1;
  }

  async loadAssets() {
    if (this.assetsReady) {
      return;
    }

    const sheets = assetManifest.characters.knight.sheets;
    this.animations.idle = await this.loadFrames(sheets.idle);
    this.animations.walk = await this.loadFrames(sheets.walk);
    this.animations.run = await this.loadFrames(sheets.run);
    const attackSegments = await this.loadAttackSegments(sheets.attack);
    this.animations.attack = attackSegments.frames;
    this.attackHitFrames = attackSegments.hitFrames;
    this.animations.runAttack = await this.loadFrames(sheets.runAttack);
    this.animations.hit = await this.loadFrames(sheets.hit);
    this.animations.dead = await this.loadFrames(sheets.dead);
    const jumpSegments = await this.loadJumpSegments(sheets.jump);
    this.jumpFrames = jumpSegments;

    this.assetsReady = true;
    this.playAnimation("idle", this.animations.idle, { loop: true });
    this.syncBoundsToSprite();
  }

  update(deltaSeconds: number, input: PlayerInput, solids: Rect[]) {
    const wasGrounded = this.grounded;
    const controlLocked = this.isControlLocked();
    const move = controlLocked ? 0 : Math.max(-1, Math.min(1, input.move));
    if (!controlLocked) {
      this.velocity.x = move * this.moveSpeed;
    }

    this.updateAttackTimers(deltaSeconds, controlLocked ? false : input.attack);
    this.updateInvincibility(deltaSeconds);
    this.updateLifeTimers(deltaSeconds);

    if (this.lifeState === "dead") {
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.updateAnimation(0, wasGrounded);
      this.syncVisual();
      return;
    }

    if (this.grounded && !controlLocked && input.jump) {
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

    this.updateAnimation(move, wasGrounded);
    this.syncVisual();
  }

  getHealth() {
    return this.health;
  }

  getMaxHealth() {
    return this.maxHealth;
  }

  applyDamage(amount: number) {
    if (amount <= 0) {
      return this.health;
    }
    this.health = Math.max(0, this.health - amount);
    return this.health;
  }

  clampToBounds(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options: { clampX?: boolean; clampY?: boolean } = {},
  ) {
    const clampX = options.clampX ?? true;
    const clampY = options.clampY ?? true;
    const maxX = bounds.maxX - this.width;
    const maxY = bounds.maxY - this.height;
    let clampedX = this.position.x;
    let clampedY = this.position.y;

    if (clampX) {
      clampedX = Math.min(Math.max(this.position.x, bounds.minX), maxX);
    }
    if (clampY) {
      clampedY = Math.min(Math.max(this.position.y, bounds.minY), maxY);
    }

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
    return this.attackState !== "idle" || this.attackVisualTimer > 0;
  }

  isDead() {
    return this.lifeState === "dead";
  }

  isControlLocked() {
    return this.lifeState !== "alive";
  }

  isDeathSequenceComplete() {
    return (
      this.lifeState === "dead" &&
      this.deathAnimationComplete &&
      this.deathHoldTimer <= 0
    );
  }

  isAttackHitActive() {
    if (this.attackVisualTimer <= 0) {
      return false;
    }
    if (this.attackHitFrames.size === 0) {
      return true;
    }
    if (
      !this.sprite ||
      (this.currentAnimation !== "attack" && this.currentAnimation !== "runAttack")
    ) {
      return false;
    }
    return this.attackHitFrames.has(this.sprite.currentFrame);
  }

  getAttackState() {
    return this.attackState;
  }

  canStartAttack() {
    return this.attackCooldownTimer <= 0 && this.attackActiveTimer <= 0;
  }

  triggerHomingAttackVisual() {
    if (!this.canStartAttack()) {
      return;
    }
    this.attackState = "homing";
    this.attackActiveTimer = this.homingDuration;
    this.attackCooldownTimer = this.homingCooldown;
    this.attackVisualTimer = this.homingVisualDuration;
    this.lastAttackType = "homing";
    this.attackSequence += 1;
    this.lastAttackAnimationId = -1;
    this.attackRestartRequested = true;
  }

  getAttackHitType() {
    if (this.attackState !== "idle") {
      return this.attackState;
    }
    return this.lastAttackType ?? "attack";
  }

  getAttackSequence() {
    return this.attackSequence;
  }

  triggerHurt(invincibleDurationSeconds: number) {
    if (this.lifeState === "dead") {
      return;
    }
    const duration = Math.max(0, invincibleDurationSeconds * 0.5);
    this.lifeState = "hurt";
    this.hurtDuration = duration;
    this.hurtTimer = duration;
    this.hurtRestartRequested = true;
    this.hurtJustEnded = false;
    this.attackState = "idle";
    this.lastAttackType = null;
    this.attackActiveTimer = 0;
    this.attackCooldownTimer = 0;
    this.attackVisualTimer = 0;
    this.attackJustEnded = false;
    this.attackRestartRequested = false;
    this.pendingAttackType = null;
  }

  triggerDeath() {
    if (this.lifeState === "dead") {
      return;
    }
    this.lifeState = "dead";
    this.deathAnimationStarted = false;
    this.deathAnimationComplete = false;
    this.deathHoldTimer = 0;
    this.attackState = "idle";
    this.lastAttackType = null;
    this.attackActiveTimer = 0;
    this.attackCooldownTimer = 0;
    this.attackVisualTimer = 0;
    this.attackJustEnded = false;
    this.attackRestartRequested = false;
    this.pendingAttackType = null;
    this.velocity.x = 0;
    this.velocity.y = 0;
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

  getHomingAttackBounceSpeed() {
    return this.jumpSpeed * 1.05;
  }

  isInvincible() {
    return this.invincibleTimer > 0;
  }

  isHomingAttackActive() {
    return this.attackState === "homing";
  }

  triggerInvincibility(durationSeconds = 1, flicker = true) {
    this.invincibleTimer = Math.max(this.invincibleTimer, durationSeconds);
    this.invincibleFlicker = flicker;
    if (this.invincibleFlicker) {
      if (this.flickerTimer <= 0) {
        this.flickerTimer = this.flickerInterval;
        this.flickerOn = false;
      }
    } else {
      this.flickerTimer = 0;
      this.flickerOn = false;
    }
    this.applyInvincibilityTint();
  }

  triggerHomingInvincibility() {
    this.triggerInvincibility(this.homingInvincibility, false);
  }

  updateAttackTimers(deltaSeconds: number, pressed: boolean) {
    if (!pressed) {
      this.pendingAttackType = null;
    }

    if (this.attackActiveTimer > 0) {
      this.attackActiveTimer = Math.max(0, this.attackActiveTimer - deltaSeconds);
      if (this.attackActiveTimer === 0 && this.attackState !== "idle") {
        this.attackState = "idle";
        this.attackJustEnded = true;
      }
    }

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - deltaSeconds);
    }

    if (this.attackVisualTimer > 0) {
      this.attackVisualTimer = Math.max(0, this.attackVisualTimer - deltaSeconds);
      if (this.attackVisualTimer === 0 && this.attackState === "idle") {
        this.lastAttackType = null;
      }
    }

    if (!pressed || this.attackCooldownTimer > 0 || this.attackActiveTimer > 0) {
      return;
    }

    const nextState = this.pendingAttackType ?? (this.grounded ? "attack" : "homing");
    this.attackState = nextState;
    this.attackActiveTimer =
      nextState === "homing" ? this.homingDuration : this.attackDuration;
    this.attackCooldownTimer =
      nextState === "homing" ? this.homingCooldown : this.attackCooldown;
    this.attackVisualTimer =
      nextState === "homing" ? this.homingVisualDuration : this.attackVisualDuration;
    this.lastAttackType = nextState;
    this.attackSequence += 1;
    this.lastAttackAnimationId = -1;
    this.pendingAttackType = null;
  }

  setNextAttackType(type: "attack" | "homing" | null) {
    this.pendingAttackType = type;
  }

  createTrailSprite() {
    if (!this.sprite) {
      return null;
    }
    const trail = new Sprite(this.sprite.texture);
    trail.anchor.set(0.5, 1);
    trail.scale.set(
      this.baseScale * this.scale * this.facing,
      this.baseScale * this.scale,
    );
    return trail;
  }

  private syncVisual() {
    this.container.x = this.position.x + this.width * 0.5;
    this.container.y =
      this.position.y + this.height + this.footOffset * this.scale;
  }

  private updateLifeTimers(deltaSeconds: number) {
    if (this.lifeState === "hurt") {
      this.hurtTimer = Math.max(0, this.hurtTimer - deltaSeconds);
      if (this.hurtTimer === 0) {
        this.lifeState = "alive";
        this.hurtJustEnded = true;
      }
    }

    if (this.lifeState === "dead" && this.deathAnimationComplete) {
      this.deathHoldTimer = Math.max(0, this.deathHoldTimer - deltaSeconds);
    }
  }

  private updateInvincibility(deltaSeconds: number) {
    if (this.invincibleTimer <= 0) {
      if (this.flickerOn || this.flickerTimer > 0) {
        this.flickerOn = false;
        this.flickerTimer = 0;
        this.applyInvincibilityTint();
      }
      return;
    }

    this.invincibleTimer = Math.max(0, this.invincibleTimer - deltaSeconds);
    if (this.invincibleFlicker) {
      this.flickerTimer = Math.max(0, this.flickerTimer - deltaSeconds);
      if (this.flickerTimer === 0) {
        this.flickerOn = !this.flickerOn;
        this.flickerTimer = this.flickerInterval;
        this.applyInvincibilityTint();
      }
    } else {
      this.flickerTimer = 0;
      this.flickerOn = false;
      this.applyInvincibilityTint();
    }

    if (this.invincibleTimer === 0) {
      this.flickerOn = false;
      this.flickerTimer = 0;
      this.invincibleFlicker = false;
      this.applyInvincibilityTint();
    }
  }

  private applyInvincibilityTint() {
    if (!this.sprite) {
      return;
    }
    if (this.invincibleTimer > 0) {
      this.sprite.tint = this.invincibleFlicker && this.flickerOn ? 0xffb3b3 : 0xffffff;
      return;
    }
    this.sprite.tint = 0xffffff;
  }

  private updateAnimation(moveInput: number, wasGrounded: boolean) {
    if (!this.assetsReady) {
      return;
    }

    const moving = Math.abs(moveInput) > 0.1;

    if (this.lifeState === "dead") {
      if (!this.deathAnimationStarted) {
        this.deathAnimationStarted = true;
        this.deathAnimationComplete = false;
        this.playAnimation("dead", this.animations.dead ?? [], {
          loop: false,
          holdLastFrame: true,
          forceRestart: true,
          onComplete: () => {
            this.deathAnimationComplete = true;
            this.deathHoldTimer = this.deathHoldDuration;
          },
        });
      }
      this.applyFacing();
      return;
    }

    if (this.lifeState === "hurt") {
      const frames = this.animations.hit ?? [];
      const speed =
        this.hurtDuration > 0 && frames.length > 0
          ? frames.length / (this.hurtDuration * this.animationFps)
          : undefined;
      this.playAnimation("hit", frames, {
        loop: false,
        holdLastFrame: true,
        forceRestart: this.hurtRestartRequested,
        speed,
      });
      this.hurtRestartRequested = false;
      this.applyFacing();
      return;
    }

    if (this.hurtJustEnded) {
      this.hurtJustEnded = false;
      if (this.grounded) {
        this.jumpPhase = "none";
        this.playGroundedAnimation(moving);
        this.applyFacing();
        return;
      }
    }
    if (moveInput < -0.1) {
      this.facing = -1;
    } else if (moveInput > 0.1) {
      this.facing = 1;
    }

    if (this.attackState !== "idle" || this.attackVisualTimer > 0) {
      const shouldRunAttack = this.grounded && moving;
      const target = shouldRunAttack ? "runAttack" : "attack";
      const frames = shouldRunAttack
        ? this.animations.runAttack ?? []
        : this.animations.attack ?? [];
      let startFrame: number | undefined;
      let forceRestart = false;
      if (this.attackSequence !== this.lastAttackAnimationId) {
        this.lastAttackAnimationId = this.attackSequence;
        startFrame = this.attackStartFrame;
        forceRestart = true;
      }
      if (
        this.currentAnimation !== "attack" &&
        this.currentAnimation !== "runAttack"
      ) {
        startFrame = this.attackStartFrame;
      } else if (this.currentAnimation !== target && this.sprite) {
        startFrame = this.sprite.currentFrame;
      } else if (this.attackRestartRequested) {
        startFrame = this.attackStartFrame;
        forceRestart = true;
      }
      this.playAnimation(target, frames, {
        loop: false,
        holdLastFrame: true,
        startFrame,
        forceRestart,
      });
      this.attackRestartRequested = false;
      this.applyFacing();
      return;
    }

    if (this.attackJustEnded) {
      if (this.grounded) {
        this.jumpPhase = "none";
      } else if (this.jumpPhase === "jumpUp") {
        this.jumpPhase = "hold";
      } else if (this.jumpFrames) {
        if (this.velocity.y > this.fallEps) {
          this.jumpPhase = "fall";
          this.playAnimation("jumpFall", this.jumpFrames.fall, {
            loop: false,
            holdLastFrame: true,
          });
        } else if (this.velocity.y < 0) {
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
        } else {
          this.jumpPhase = "hold";
          this.playAnimation("jumpHold", this.jumpFrames.hold, { loop: false });
        }
      }
      this.attackJustEnded = false;
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
      | "attack"
      | "runAttack"
      | "hit"
      | "dead"
      | "jumpUp"
      | "jumpHold"
      | "jumpFall"
      | "jumpLand",
    frames: Texture[],
    options: {
      loop: boolean;
      onComplete?: () => void;
      holdLastFrame?: boolean;
      startFrame?: number;
      forceRestart?: boolean;
      speed?: number;
    },
  ) {
    if (this.currentAnimation === name && !options.forceRestart) {
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
    if (options.speed !== undefined) {
      sprite.animationSpeed = Math.max(0.05, Math.min(1, options.speed));
    } else {
      sprite.animationSpeed = this.baseAnimationSpeed;
    }
    sprite.loop = options.loop;
    const startFrame =
      options.startFrame !== undefined
        ? Math.min(Math.max(0, options.startFrame), frames.length - 1)
        : undefined;
    if (frames.length === 1) {
      sprite.gotoAndStop(0);
    } else if (options.loop) {
      sprite.play();
    } else if (startFrame !== undefined) {
      sprite.gotoAndPlay(startFrame);
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

  private async loadFrames(sheetPath: string) {
    const { json: jsonPath, image: imagePath } = getSpriteSheetPaths(sheetPath);
    try {
      const sheet = (await Assets.load(jsonPath)) as Spritesheet;
      const frames = this.extractFrames(sheet);
      if (frames.length > 0) {
        return this.downscaleFrames(frames);
      }
    } catch {
      // Fallback to single texture if spritesheet JSON is missing.
    }

    const texture = (await Assets.load(imagePath)) as Texture;
    return this.downscaleFrames([texture]);
  }

  private async loadAttackSegments(sheetPath: string) {
    const { json: jsonPath } = getSpriteSheetPaths(sheetPath);
    try {
      const sheet = (await Assets.load(jsonPath)) as Spritesheet;
      const originalFrames = this.extractFrames(sheet);
      const frames = await this.downscaleFrames(originalFrames);
      const animations = sheet.animations;
      const hitFrames =
        animations?.attackHit ??
        animations?.AttackHit ??
        animations?.attack_hit ??
        animations?.Attack_hit ??
        animations?.attackhit ??
        animations?.Attackhit;
      const hitSet = new Set<number>();
      const frameIndex = new Map<Texture, number>();
      originalFrames.forEach((frame, index) => {
        frameIndex.set(frame, index);
      });
      if (hitFrames && hitFrames.length > 0) {
        for (const frame of hitFrames) {
          const index = frameIndex.get(frame);
          if (index !== undefined) {
            hitSet.add(index);
          }
        }
      } else if (frames.length >= 10) {
        hitSet.add(8);
        hitSet.add(9);
      }
      return { frames, hitFrames: hitSet };
    } catch {
      const frames = await this.loadFrames(sheetPath);
      const hitSet = new Set<number>();
      if (frames.length >= 10) {
        hitSet.add(8);
        hitSet.add(9);
      }
      return { frames, hitFrames: hitSet };
    }
  }

  private async loadJumpSegments(sheetPath: string) {
    const { json: jsonPath } = getSpriteSheetPaths(sheetPath);
    try {
      const sheet = (await Assets.load(jsonPath)) as Spritesheet;
      const animations = sheet.animations;
      const jumpUp = animations?.jumpUp ?? animations?.JumpUp;
      const jumpHold = animations?.jumpHold ?? animations?.JumpHold;
      const jumpFall = animations?.jumpFall ?? animations?.JumpFall;
      const jumpLand = animations?.jumpLand ?? animations?.JumpLand;

      if (jumpUp && jumpHold && jumpFall && jumpLand) {
        const [scaledUp, scaledHold, scaledFall, scaledLand] = await Promise.all([
          this.downscaleFrames(jumpUp),
          this.downscaleFrames(jumpHold),
          this.downscaleFrames(jumpFall),
          this.downscaleFrames(jumpLand),
        ]);
        return {
          jumpUp: scaledUp,
          hold: scaledHold,
          fall: scaledFall,
          land: scaledLand,
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  private async downscaleFrames(frames: Texture[]) {
    if (this.textureScale >= 1) {
      return frames;
    }

    const scaledFrames: Texture[] = [];
    for (const frame of frames) {
      const resource = frame.source?.resource as CanvasImageSource | undefined;
      if (!resource) {
        scaledFrames.push(frame);
        continue;
      }
      const { x, y, width, height } = frame.frame;
      const targetWidth = Math.max(1, Math.round(width * this.textureScale));
      const targetHeight = Math.max(1, Math.round(height * this.textureScale));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        scaledFrames.push(frame);
        continue;
      }
      ctx.drawImage(resource, x, y, width, height, 0, 0, targetWidth, targetHeight);
      scaledFrames.push(Texture.from(canvas));
    }

    return scaledFrames;
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

  private syncBoundsToSprite() {
    if (!this.sprite) {
      return;
    }
    const texture = this.sprite.texture;
    const frameHeight = texture?.orig?.height ?? texture.height;
    if (!frameHeight) {
      return;
    }
    const scaledHeight = frameHeight * this.baseScale * this.scale;
    if (!Number.isFinite(scaledHeight) || scaledHeight <= 0) {
      return;
    }
    const oldBottom = this.position.y + this.height;
    this.height = scaledHeight;
    this.position.y = oldBottom - this.height;
  }
}
