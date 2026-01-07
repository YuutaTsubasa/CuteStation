import { Graphics, type Container } from "pixi.js";
import { Physics, type Rect } from "../systems/Physics";

type PlayerInput = {
  move: number;
  jump: boolean;
};

export class Player {
  private readonly body: Graphics;

  readonly width = 48;
  readonly height = 64;

  position = { x: 0, y: 0 };
  velocity = { x: 0, y: 0 };
  grounded = false;

  private readonly moveSpeed = 240;
  private readonly jumpSpeed = 520;
  private readonly gravity = 1100;
  private readonly maxFallSpeed = 800;

  constructor(startX = 120, startY = 360) {
    this.position.x = startX;
    this.position.y = startY;

    this.body = new Graphics();
    this.body.rect(0, 0, this.width, this.height).fill(0x8fd1ff);
  }

  mount(stage: Container) {
    stage.addChild(this.body);
    this.syncVisual();
  }

  destroy() {
    this.body.removeFromParent();
    this.body.destroy();
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
    this.body.x = this.position.x;
    this.body.y = this.position.y;
  }
}
