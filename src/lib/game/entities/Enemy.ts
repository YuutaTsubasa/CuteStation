import {
  AnimatedSprite,
  Assets,
  Container,
  Graphics,
  type Spritesheet,
  type Texture,
} from "pixi.js";
import { Physics, type Rect } from "../systems/Physics";
import { assetManifest, getSpriteSheetPaths } from "../assets/AssetManifest";

export class Enemy {
  private readonly container = new Container();
  private readonly body = new Graphics();
  private sprite: AnimatedSprite | null = null;
  private animations: { run: Texture[]; hit: Texture[] } | null = null;
  private currentAnimation: "run" | "hit" | null = null;
  private assetsReady = false;
  private readonly runAnimationSpeed = 0.18;
  private readonly hitAnimationSpeed = 0.12;
  private spriteBaseScale = 1;
  private spriteScaleMultiplier = 1;
  private visualOffsetY = 0;
  private hurtFlickerTimer = 0;
  private readonly hurtFlickerInterval = 0.08;
  private hurtFlickerOn = false;
  private hurtFlickerRemaining = 0;
  private edgeTurnCooldown = 0;
  private hideOnHitComplete = false;
  private deathFadeTimer = 0;
  private deathFadeDuration = 0.35;
  private readonly scale: number;
  private readonly baseWidth: number;
  private readonly baseHeight: number;
  private readonly gravity: number;
  private readonly maxFallSpeed: number;
  private readonly gravityEnabled: boolean;
  private readonly knockbackDamp = 10;
  private hurtTimer = 0;
  private idleTimer = 0;
  private readonly idleDuration: number;
  private readonly patrolSpeed: number;
  private patrolMinX: number;
  private patrolMaxX: number;
  private patrolDirection = 1;
  private facing = 1;
  private readonly behavior: "idle" | "patrol";
  private readonly assetId: keyof typeof assetManifest.enemies;
  private readonly edgeProbeOffset: number;

  width: number;
  height: number;

  position = { x: 0, y: 0 };
  velocity = { x: 0, y: 0 };
  grounded = false;
  health: number;
  state: "idle" | "patrol" | "hurt" | "dead" = "idle";

  constructor(
    startX: number,
    startY: number,
    scale = 1,
    options: {
      behavior?: "idle" | "patrol";
      patrolRange?: number;
      patrolSpeed?: number;
      idleDuration?: number;
      gravityEnabled?: boolean;
      assetId?: keyof typeof assetManifest.enemies;
      hitbox?: { width: number; height: number };
      spriteScaleMultiplier?: number;
      visualOffsetY?: number;
    } = {},
  ) {
    this.scale = scale;
    this.baseWidth = 48 * this.scale;
    this.baseHeight = 64 * this.scale;
    this.width = (options.hitbox?.width ?? 48) * this.scale;
    this.height = (options.hitbox?.height ?? 64) * this.scale;
    this.gravity = 1000 * this.scale;
    this.maxFallSpeed = 900 * this.scale;
    this.gravityEnabled = options.gravityEnabled ?? true;
    this.behavior = options.behavior ?? "patrol";
    this.assetId = options.assetId ?? "slime";
    this.spriteScaleMultiplier =
      options.spriteScaleMultiplier ??
      (this.assetId === "slime" ? 1.5 : this.assetId === "crystal" ? 2 : 1);
    this.visualOffsetY = (options.visualOffsetY ?? 0) * this.scale;
    this.patrolSpeed = (options.patrolSpeed ?? 80) * this.scale;
    const spawnOffsetX = (this.baseWidth - this.width) * 0.5;
    const spawnOffsetY = this.baseHeight - this.height;
    this.position.x = startX * this.scale + spawnOffsetX;
    this.position.y = startY * this.scale + spawnOffsetY;
    const patrolRange = (options.patrolRange ?? 96) * this.scale;
    this.patrolMinX = this.position.x - patrolRange;
    this.patrolMaxX = this.position.x + patrolRange;
    this.health = 3;
    this.idleDuration = options.idleDuration ?? 0.5;
    this.idleTimer = this.idleDuration;
    this.edgeProbeOffset = 0.01 * this.scale;
    if (this.behavior === "patrol" && this.idleDuration <= 0) {
      this.state = "patrol";
    }

    this.body.rect(0, 0, this.width, this.height).fill(0xd14545);
    this.container.addChild(this.body);
    this.syncVisual();
  }

  mount(stage: Container) {
    stage.addChild(this.container);
    this.syncVisual();
  }

  destroy() {
    this.container.removeFromParent();
    this.container.destroy({ children: true });
  }

  async loadAssets() {
    if (this.assetsReady) {
      return;
    }

    const enemyAssets = assetManifest.enemies[this.assetId];
    if (!enemyAssets) {
      return;
    }
    const sheets = enemyAssets.sheets as { run?: string; hit?: string; idle?: string };
    const runPath = sheets.run ?? sheets.idle ?? sheets.hit;
    const hitPath = sheets.hit ?? sheets.idle ?? sheets.run;

    let runFrames: Texture[] = [];
    let hitFrames: Texture[] = [];
    if (runPath) {
      runFrames = await this.loadFrames(runPath);
    }
    if (hitPath) {
      hitFrames = await this.loadFrames(hitPath);
    }
    if (runFrames.length === 0 && hitFrames.length > 0) {
      runFrames = hitFrames;
    }
    if (hitFrames.length === 0 && runFrames.length > 0) {
      hitFrames = runFrames;
    }

    this.animations = { run: runFrames, hit: hitFrames };
    this.assetsReady = true;
    this.body.visible = false;
    this.updateAnimationState(true);
  }

  update(deltaSeconds: number, solids: Rect[]) {
    if (this.state === "dead") {
      this.updateDeathFade(deltaSeconds);
      this.syncVisual();
      return;
    }

    const previousPosition = { ...this.position };
    if (this.edgeTurnCooldown > 0) {
      this.edgeTurnCooldown = Math.max(0, this.edgeTurnCooldown - deltaSeconds);
    }
    if (this.hurtTimer > 0) {
      this.hurtTimer = Math.max(0, this.hurtTimer - deltaSeconds);
      if (this.hurtTimer === 0 && this.state === "hurt") {
        this.state = "idle";
        this.idleTimer = this.idleDuration;
      }
    }
    this.updateHurtFlicker(deltaSeconds);
    if (this.hurtFlickerRemaining <= 0) {
      this.setTint(0xffffff);
      this.container.alpha = 1;
    }

    this.updateBehavior(deltaSeconds);
    const safeDelta = deltaSeconds > 0 ? deltaSeconds : 1 / 60;
    let preTurned = false;
    if (this.state === "patrol") {
      const projectedX = this.position.x + this.velocity.x * safeDelta;
      if (this.shouldTurnAtEdge(solids, projectedX)) {
        this.setPatrolDirection(this.patrolDirection * -1, false);
        preTurned = true;
      }
    }

    if (this.gravityEnabled) {
      this.velocity.y = Math.min(
        this.velocity.y + this.gravity * deltaSeconds,
        this.maxFallSpeed,
      );
    } else {
      this.velocity.y = 0;
    }
    if (this.state === "hurt") {
      this.velocity.x += -this.velocity.x * Math.min(deltaSeconds * this.knockbackDamp, 1);
    }

    const rect = this.getRect();
    const desiredVx = this.velocity.x;
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

    if (this.state === "patrol") {
      if (!preTurned && this.position.y > previousPosition.y + 0.5) {
        this.position.x = previousPosition.x;
        this.position.y = previousPosition.y;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.setPatrolDirection(this.patrolDirection * -1, false);
        preTurned = true;
      }
      let hitBounds = false;
      if (preTurned) {
        hitBounds = true;
      }
      if (this.position.x <= this.patrolMinX) {
        this.position.x = this.patrolMinX;
        this.setPatrolDirection(1, false);
        hitBounds = true;
      } else if (this.position.x >= this.patrolMaxX) {
        this.position.x = this.patrolMaxX;
        this.setPatrolDirection(-1, false);
        hitBounds = true;
      }
      if (!hitBounds && Math.abs(resolved.vx) <= 0.01 && Math.abs(desiredVx) > 0.01) {
        this.setPatrolDirection(this.patrolDirection * -1, false);
      }
    }

    this.updateAnimationState();
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

  applyHit(damage: number, knockback: { x: number; y: number }) {
    if (this.state === "dead") {
      return false;
    }

    this.health = Math.max(0, this.health - damage);
    this.velocity.x = knockback.x;
    this.velocity.y = knockback.y;
    this.state = this.health <= 0 ? "dead" : "hurt";
    this.hurtTimer = this.state === "dead" ? 0 : 0.5;
    this.hurtFlickerTimer = this.hurtFlickerInterval;
    this.hurtFlickerOn = false;
    this.hurtFlickerRemaining = 0.5;
    this.hideOnHitComplete = this.state === "dead";
    this.container.visible = true;
    this.container.alpha = 1;
    this.deathFadeTimer = 0;
    this.setTint(0xffb3b3);
    this.updateAnimationState(true);
    return true;
  }

  isDead() {
    return this.state === "dead";
  }

  resolveSpawn(solids: Rect[]) {
    if (!this.gravityEnabled) {
      return;
    }
    const rect = this.getRect();
    const resolved = Physics.resolve(rect, { x: 0, y: 1 }, solids);
    this.position.x = resolved.x;
    this.position.y = resolved.y;
    this.velocity.x = resolved.vx;
    this.velocity.y = resolved.vy;
    this.syncVisual();
  }

  private updateBehavior(deltaSeconds: number) {
    if (this.state === "dead" || this.state === "hurt") {
      return;
    }

    if (this.behavior === "idle") {
      this.velocity.x = 0;
      return;
    }

    if (this.state === "idle") {
      this.idleTimer = Math.max(0, this.idleTimer - deltaSeconds);
      this.velocity.x = 0;
      if (this.idleTimer === 0) {
        this.state = "patrol";
      }
      return;
    }

    if (this.state === "patrol") {
      this.velocity.x = this.patrolSpeed * this.patrolDirection;
    }
  }

  private setPatrolDirection(direction: number, pause: boolean) {
    this.patrolDirection = direction >= 0 ? 1 : -1;
    this.facing = this.patrolDirection;
    this.applyFacing();
    this.edgeTurnCooldown = 0.18;
    if (pause) {
      this.state = "idle";
      this.idleTimer = this.idleDuration;
      this.velocity.x = 0;
    }
  }

  private updateAnimationState(forceRestart = false) {
    if (!this.assetsReady || !this.animations) {
      return;
    }

    if (this.state === "hurt" || this.state === "dead") {
      if (this.state === "dead") {
        this.deathFadeDuration = this.getAnimationDuration(
          this.animations.hit,
          this.hitAnimationSpeed,
        );
      }
      this.playAnimation("hit", this.animations.hit, {
        loop: this.state !== "dead",
        holdLastFrame: true,
        speed: this.hitAnimationSpeed,
        forceRestart,
        onComplete: () => {
          if (this.hideOnHitComplete) {
            this.container.visible = false;
          }
        },
      });
      return;
    }

    this.playAnimation("run", this.animations.run, {
      loop: true,
      speed: this.runAnimationSpeed,
      forceRestart,
    });
  }

  private playAnimation(
    name: "run" | "hit",
    frames: Texture[],
    options: {
      loop: boolean;
      holdLastFrame?: boolean;
      forceRestart?: boolean;
      speed?: number;
      onComplete?: () => void;
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
    sprite.animationSpeed = options.speed ?? 0.2;
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

    const frameHeight = frames[0].orig?.height ?? frames[0].height;
    const baseScale = frameHeight ? this.baseHeight / frameHeight : 1;
    this.spriteBaseScale = baseScale * this.spriteScaleMultiplier;
    sprite.position.set(this.width * 0.5, this.height + this.visualOffsetY);
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
        return frames;
      }
    } catch {
      // Fallback to single texture if spritesheet JSON is missing.
    }

    const texture = (await Assets.load(imagePath)) as Texture;
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

  private getAnimationDuration(frames: Texture[], speed: number) {
    if (!frames || frames.length === 0) {
      return 0.3;
    }
    const framesPerSecond = Math.max(1, 60 * speed);
    return Math.max(0.1, frames.length / framesPerSecond);
  }

  private updateHurtFlicker(deltaSeconds: number) {
    if (this.hurtFlickerRemaining <= 0) {
      return;
    }

    this.hurtFlickerRemaining = Math.max(0, this.hurtFlickerRemaining - deltaSeconds);
    this.hurtFlickerTimer = Math.max(0, this.hurtFlickerTimer - deltaSeconds);
    if (this.hurtFlickerTimer === 0) {
      this.hurtFlickerOn = !this.hurtFlickerOn;
      this.hurtFlickerTimer = this.hurtFlickerInterval;
    }
    this.setTint(this.hurtFlickerOn ? 0xffffff : 0xffb3b3);
  }

  private setTint(tint: number) {
    if (this.sprite) {
      this.sprite.tint = tint;
    } else {
      this.body.tint = tint;
    }
  }

  private applyFacing() {
    if (!this.sprite) {
      return;
    }
    this.sprite.scale.set(this.spriteBaseScale * this.facing, this.spriteBaseScale);
  }

  private updateDeathFade(deltaSeconds: number) {
    if (this.state !== "dead") {
      return;
    }

    this.deathFadeTimer += deltaSeconds;
    const duration = Math.max(0.1, this.deathFadeDuration);
    const t = Math.min(1, this.deathFadeTimer / duration);
    this.container.alpha = 1 - t;
    if (t >= 1) {
      this.container.visible = false;
    }
  }

  private syncVisual() {
    this.container.x = this.position.x;
    this.container.y = this.position.y;
  }

  private shouldTurnAtEdge(solids: Rect[], baseX: number) {
    if (this.edgeTurnCooldown > 0) {
      return false;
    }
    if (!this.grounded) {
      return false;
    }
    const footY = this.position.y + this.height;
    const centerX = baseX + this.width * 0.5;
    if (!this.hasSolidBelow(centerX, footY + this.edgeProbeOffset, solids)) {
      return true;
    }

    const halfWidth = this.width * 0.5;
    const frontStart = this.patrolDirection > 0 ? baseX + halfWidth : baseX;
    const frontEnd = this.patrolDirection > 0 ? baseX + this.width : baseX + halfWidth;
    const frontTop = this.getFloorTopAt(frontStart, frontEnd, solids);
    if (frontTop === null) {
      return true;
    }

    const lookAhead = halfWidth * this.patrolDirection;
    const aheadX = baseX + lookAhead;
    const aheadTop = this.getFloorTopAt(aheadX, aheadX + this.width, solids);
    if (aheadTop === null) {
      return true;
    }

    return false;
  }

  private getFloorTopAt(xStart: number, xEnd: number, solids: Rect[]) {
    let best: number | null = null;
    for (const solid of solids) {
      const overlap = xStart < solid.x + solid.width && xEnd > solid.x;
      if (!overlap) {
        continue;
      }
      if (best === null || solid.y > best) {
        best = solid.y;
      }
    }
    return best;
  }

  private hasSolidBelow(x: number, y: number, solids: Rect[]) {
    return solids.some(
      (solid) =>
        x >= solid.x &&
        x <= solid.x + solid.width &&
        y >= solid.y &&
        y <= solid.y + solid.height,
    );
  }
}
