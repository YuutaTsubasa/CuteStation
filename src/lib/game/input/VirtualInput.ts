export type VirtualInputState = {
  moveX: number;
  jumpDown: boolean;
  jumpHeld: boolean;
};

export class VirtualInput {
  private state: VirtualInputState = {
    moveX: 0,
    jumpDown: false,
    jumpHeld: false,
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

  consumeFrame(): VirtualInputState {
    const snapshot = { ...this.state };
    this.state.jumpDown = false;
    return snapshot;
  }

  reset() {
    this.state = { moveX: 0, jumpDown: false, jumpHeld: false };
  }
}
