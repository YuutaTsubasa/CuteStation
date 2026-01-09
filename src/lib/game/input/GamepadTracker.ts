export type GamepadState = {
  moveX: number;
  moveY: number;
  buttonsHeld: boolean[];
  buttonsDown: boolean[];
  anyButtonDown: boolean;
};

const DEADZONE = 0.2;

const applyDeadzone = (value: number) => {
  if (Math.abs(value) < DEADZONE) {
    return 0;
  }
  return Math.max(-1, Math.min(1, value));
};

export class GamepadTracker {
  private lastButtons: boolean[] = [];

  poll(): GamepadState | null {
    const gamepads = navigator.getGamepads?.() ?? [];
    const gamepad = Array.from(gamepads).find((pad) => pad && pad.connected);
    if (!gamepad) {
      this.lastButtons = [];
      return null;
    }

    const buttonsHeld = gamepad.buttons.map((button) => button.pressed);
    const buttonsDown = buttonsHeld.map((pressed, index) => pressed && !this.lastButtons[index]);
    this.lastButtons = buttonsHeld;

    const dpadLeft = buttonsHeld[14];
    const dpadRight = buttonsHeld[15];
    const dpadUp = buttonsHeld[12];
    const dpadDown = buttonsHeld[13];

    let moveX = 0;
    let moveY = 0;

    if (dpadLeft) {
      moveX = -1;
    } else if (dpadRight) {
      moveX = 1;
    } else {
      moveX = applyDeadzone(gamepad.axes[0] ?? 0);
    }

    if (dpadUp) {
      moveY = -1;
    } else if (dpadDown) {
      moveY = 1;
    } else {
      moveY = applyDeadzone(gamepad.axes[1] ?? 0);
    }

    return {
      moveX,
      moveY,
      buttonsHeld,
      buttonsDown,
      anyButtonDown: buttonsDown.some(Boolean),
    };
  }
}
