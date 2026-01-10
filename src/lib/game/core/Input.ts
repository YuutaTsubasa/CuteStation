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
    const pad =
      Array.from(pads).find((entry) => entry && entry.connected) ?? null;
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

    const buttonsHeld = pad.buttons.map((button) => button.pressed);
    const dpadLeft = buttonsHeld[14];
    const dpadRight = buttonsHeld[15];

    let moveX = 0;
    if (dpadLeft) {
      moveX = -1;
    } else if (dpadRight) {
      moveX = 1;
    } else {
      const rawMove = pad.axes[0] ?? 0;
      moveX = Math.abs(rawMove) >= this.deadzone ? rawMove : 0;
    }

    const jumpHeld = Boolean(buttonsHeld[0] || buttonsHeld[1]);
    const attackHeld = Boolean(buttonsHeld[2] || buttonsHeld[3]);
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
