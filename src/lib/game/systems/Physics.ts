export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CollisionResult = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
};

export class Physics {
  static resolve(
    rect: Rect,
    velocity: { x: number; y: number },
    solids: Rect[],
  ): CollisionResult {
    let { x, y } = rect;
    let { x: vx, y: vy } = velocity;
    let grounded = false;

    x += vx;
    for (const solid of solids) {
      if (Physics.overlaps({ x, y, width: rect.width, height: rect.height }, solid)) {
        if (vx > 0) {
          x = solid.x - rect.width;
        } else if (vx < 0) {
          x = solid.x + solid.width;
        }
        vx = 0;
      }
    }

    y += vy;
    for (const solid of solids) {
      if (Physics.overlaps({ x, y, width: rect.width, height: rect.height }, solid)) {
        if (vy > 0) {
          y = solid.y - rect.height;
          vy = 0;
          grounded = true;
        } else if (vy < 0) {
          y = solid.y + solid.height;
          vy = 0;
        }
      }
    }

    return { x, y, vx, vy, grounded };
  }

  static overlaps(a: Rect, b: Rect) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }
}
