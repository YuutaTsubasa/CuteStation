export type VirtualInputState = {
  moveX: number;
  jumpDown: boolean;
  jumpHeld: boolean;
  attackDown: boolean;
  attackHeld: boolean;
};

export class VirtualInput {
  private state: VirtualInputState = {
    moveX: 0,
    jumpDown: false,
    jumpHeld: false,
    attackDown: false,
    attackHeld: false,
  };

  setMoveX(value: number) {
    this.state.moveX = Math.max(-1, Math.min(1, value));
  }

  pressJump() {
    if (!this.state.jumpHeld) {
      this.state.jumpDown = true;
    }
    this.state.jumpHeld = true;
  }

  releaseJump() {
    this.state.jumpHeld = false;
  }

  pressAttack() {
    if (!this.state.attackHeld) {
      this.state.attackDown = true;
    }
    this.state.attackHeld = true;
  }

  releaseAttack() {
    this.state.attackHeld = false;
  }

  consumeFrame(): VirtualInputState {
    const snapshot = { ...this.state };
    this.state.jumpDown = false;
    this.state.attackDown = false;
    return snapshot;
  }

  reset() {
    this.state = {
      moveX: 0,
      jumpDown: false,
      jumpHeld: false,
      attackDown: false,
      attackHeld: false,
    };
  }
}
