import { Graphics, type Container } from "pixi.js";

type PlayerInput = {
  move: number;
  jump: boolean;
};

export class Player {
  private readonly body: Graphics;
  private readonly startX: number;
  private readonly startY: number;

  position = { x: 0, y: 0 };
  velocity = { x: 0, y: 0 };
  grounded = false;

  private readonly moveSpeed = 240;
  private readonly jumpSpeed = 420;
  private readonly gravity = 1200;
  private readonly maxFallSpeed = 800;
  private readonly floorY = 420;

  constructor(startX = 120, startY = 0) {
    this.startX = startX;
    this.startY = startY || this.floorY;
    this.position.x = this.startX;
    this.position.y = this.startY;

    this.body = new Graphics();
    this.body.rect(0, 0, 48, 64).fill(0x8fd1ff);
  }

  mount(stage: Container) {
    stage.addChild(this.body);
    this.syncVisual();
  }

  destroy() {
    this.body.removeFromParent();
    this.body.destroy();
  }

  update(deltaSeconds: number, input: PlayerInput) {
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

    this.position.x += this.velocity.x * deltaSeconds;
    this.position.y += this.velocity.y * deltaSeconds;

    if (this.position.y >= this.floorY) {
      this.position.y = this.floorY;
      this.velocity.y = 0;
      this.grounded = true;
    }

    this.syncVisual();
  }

  private syncVisual() {
    this.body.x = this.position.x;
    this.body.y = this.position.y;
  }
}
