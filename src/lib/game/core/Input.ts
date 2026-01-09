export type GamepadInputState = {
  moveX: number;
  jumpDown: boolean;
  jumpHeld: boolean;
  attackDown: boolean;
  attackHeld: boolean;
};

export class Input {
  private lastGamepadJump = false;
  private lastGamepadAttack = false;
  private readonly deadzone = 0.2;

  readGamepad(): GamepadInputState {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads.find((entry) => entry && entry.connected) ?? null;
    if (!pad) {
      this.lastGamepadJump = false;
      this.lastGamepadAttack = false;
      return {
        moveX: 0,
        jumpDown: false,
        jumpHeld: false,
        attackDown: false,
        attackHeld: false,
      };
    }

    const rawMove = pad.axes[0] ?? 0;
    const moveX = Math.abs(rawMove) >= this.deadzone ? rawMove : 0;
    const jumpHeld = Boolean(pad.buttons[0]?.pressed);
    const attackHeld = Boolean(pad.buttons[2]?.pressed);
    const jumpDown = jumpHeld && !this.lastGamepadJump;
    const attackDown = attackHeld && !this.lastGamepadAttack;

    this.lastGamepadJump = jumpHeld;
    this.lastGamepadAttack = attackHeld;

    return {
      moveX,
      jumpDown,
      jumpHeld,
      attackDown,
      attackHeld,
    };
  }

  reset() {
    this.lastGamepadJump = false;
    this.lastGamepadAttack = false;
  }
}
