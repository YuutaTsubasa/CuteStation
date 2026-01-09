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

  readonly width: number;
  readonly height: number;

  position = { x: 0, y: 0 };
  velocity = { x: 0, y: 0 };
  health: number;
  state: "idle" | "hurt" | "dead" = "idle";

  constructor(startX: number, startY: number, scale = 1) {
    this.scale = scale;
    this.width = 48 * this.scale;
    this.height = 64 * this.scale;
    this.gravity = 1000 * this.scale;
    this.maxFallSpeed = 900 * this.scale;
    this.position.x = startX * this.scale;
    this.position.y = startY * this.scale;
    this.health = 3;

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
        this.body.tint = 0xffffff;
      }
    }

    this.velocity.y = Math.min(
      this.velocity.y + this.gravity * deltaSeconds,
      this.maxFallSpeed,
    );
    this.velocity.x += -this.velocity.x * Math.min(deltaSeconds * this.knockbackDamp, 1);

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

  private syncVisual() {
    this.container.x = this.position.x;
    this.container.y = this.position.y;
  }
}
