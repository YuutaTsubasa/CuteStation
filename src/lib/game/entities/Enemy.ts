import { Container, Graphics } from "pixi.js";
import { Physics, type Rect } from "../systems/Physics";

export class Enemy {
  private readonly container = new Container();
  private readonly body = new Graphics();
  private readonly scale: number;
  private readonly gravity: number;
  private readonly maxFallSpeed: number;
  private readonly knockbackDamp = 10;
  private hurtTimer = 0;
  private idleTimer = 0;
  private readonly idleDuration: number;
  private readonly patrolSpeed: number;
  private readonly patrolMinX: number;
  private readonly patrolMaxX: number;
  private patrolDirection = 1;
  private readonly behavior: "idle" | "patrol";
  private readonly patrolStepTolerance: number;

  readonly width: number;
  readonly height: number;

  position = { x: 0, y: 0 };
  velocity = { x: 0, y: 0 };
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
    } = {},
  ) {
    this.scale = scale;
    this.width = 48 * this.scale;
    this.height = 64 * this.scale;
    this.gravity = 1000 * this.scale;
    this.maxFallSpeed = 900 * this.scale;
    this.behavior = options.behavior ?? "patrol";
    this.patrolSpeed = (options.patrolSpeed ?? 80) * this.scale;
    this.position.x = startX * this.scale;
    this.position.y = startY * this.scale;
    const patrolRange = (options.patrolRange ?? 96) * this.scale;
    this.patrolMinX = this.position.x - patrolRange;
    this.patrolMaxX = this.position.x + patrolRange;
    this.health = 3;
    this.idleDuration = options.idleDuration ?? 0.5;
    this.idleTimer = this.idleDuration;
    this.patrolStepTolerance = 8 * this.scale;
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

  update(deltaSeconds: number, solids: Rect[]) {
    if (this.state === "dead") {
      return;
    }

    if (this.hurtTimer > 0) {
      this.hurtTimer = Math.max(0, this.hurtTimer - deltaSeconds);
      if (this.hurtTimer === 0 && this.state === "hurt") {
        this.state = "idle";
        this.idleTimer = this.idleDuration;
        this.body.tint = 0xffffff;
      }
    }

    this.updateBehavior(deltaSeconds);
    const safeDelta = deltaSeconds > 0 ? deltaSeconds : 1 / 60;
    let preTurned = false;
    if (this.state === "patrol") {
      const projectedX = this.position.x + this.velocity.x * safeDelta;
      if (this.shouldTurnAtEdge(solids, projectedX)) {
        this.setPatrolDirection(this.patrolDirection * -1, true);
        preTurned = true;
      }
    }

    this.velocity.y = Math.min(
      this.velocity.y + this.gravity * deltaSeconds,
      this.maxFallSpeed,
    );
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

    if (this.state === "patrol") {
      let hitBounds = false;
      if (preTurned) {
        hitBounds = true;
      }
      if (this.position.x <= this.patrolMinX) {
        this.position.x = this.patrolMinX;
        this.setPatrolDirection(1, true);
        hitBounds = true;
      } else if (this.position.x >= this.patrolMaxX) {
        this.position.x = this.patrolMaxX;
        this.setPatrolDirection(-1, true);
        hitBounds = true;
      }
      if (!hitBounds && Math.abs(resolved.vx) <= 0.01 && Math.abs(desiredVx) > 0.01) {
        this.setPatrolDirection(this.patrolDirection * -1, true);
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

  applyHit(damage: number, knockback: { x: number; y: number }) {
    if (this.state === "dead") {
      return false;
    }

    this.health = Math.max(0, this.health - damage);
    this.velocity.x = knockback.x;
    this.velocity.y = knockback.y;
    this.state = this.health <= 0 ? "dead" : "hurt";
    this.hurtTimer = this.state === "dead" ? 0 : 0.2;
    this.body.tint = this.state === "dead" ? 0x6b6b6b : 0xffb3b3;
    this.container.visible = this.state !== "dead";
    return true;
  }

  isDead() {
    return this.state === "dead";
  }

  resolveSpawn(solids: Rect[]) {
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
    if (pause) {
      this.state = "idle";
      this.idleTimer = this.idleDuration;
      this.velocity.x = 0;
    }
  }

  private syncVisual() {
    this.container.x = this.position.x;
    this.container.y = this.position.y;
  }

  private shouldTurnAtEdge(solids: Rect[], baseX: number) {
    const footY = this.position.y + this.height;
    const floorTop = this.getFloorTopAt(baseX, baseX + this.width, solids);
    if (floorTop === null || Math.abs(footY - floorTop) > 1) {
      return false;
    }

    const lookAhead = this.width * 0.5 * this.patrolDirection;
    const aheadX = baseX + lookAhead;
    const aheadTop = this.getFloorTopAt(aheadX, aheadX + this.width, solids);
    if (aheadTop === null) {
      return true;
    }

    return Math.abs(aheadTop - floorTop) > this.patrolStepTolerance;
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
}
