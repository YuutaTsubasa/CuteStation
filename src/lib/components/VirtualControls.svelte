<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { VirtualInput } from "$lib/game/input/VirtualInput";

  const { input } = $props<{ input: VirtualInput }>();

  const deadzone = 0.15;
  let joystickBase: HTMLDivElement | null = null;
  let attackButton: HTMLButtonElement | null = null;
  let jumpButton: HTMLButtonElement | null = null;
  let activePointerId: number | null = null;
  let stickOffset = $state({ x: 0, y: 0 });

  function updateStick(event: PointerEvent) {
    if (!joystickBase) {
      return;
    }

    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.35;
    if (maxRadius <= 0) {
      return;
    }

    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const clampedRatio = distance > maxRadius ? maxRadius / distance : 1;
    const clampedX = dx * clampedRatio;
    const clampedY = dy * clampedRatio;

    stickOffset = { x: clampedX, y: clampedY };

    let moveX = clampedX / maxRadius;
    if (Math.abs(moveX) < deadzone) {
      moveX = 0;
    }

    input.setMoveX(moveX);
  }

  function onStickDown(event: PointerEvent) {
    if (event.button !== 0 && event.pointerType === "mouse") {
      return;
    }

    activePointerId = event.pointerId;
    joystickBase?.setPointerCapture(event.pointerId);
    updateStick(event);
    event.preventDefault();
  }

  function onStickMove(event: PointerEvent) {
    if (activePointerId !== event.pointerId) {
      return;
    }

    updateStick(event);
    event.preventDefault();
  }

  function onStickUp(event: PointerEvent) {
    if (activePointerId !== event.pointerId) {
      return;
    }

    joystickBase?.releasePointerCapture(event.pointerId);
    activePointerId = null;
    stickOffset = { x: 0, y: 0 };
    input.setMoveX(0);
  }

  const blockTouch = (event: TouchEvent) => {
    event.preventDefault();
  };

  const bindTouchBlock = (element: HTMLElement | null) => {
    if (!element) {
      return () => {};
    }

    element.addEventListener("touchstart", blockTouch, { passive: false });
    element.addEventListener("touchmove", blockTouch, { passive: false });
    element.addEventListener("touchend", blockTouch, { passive: false });
    return () => {
      element.removeEventListener("touchstart", blockTouch);
      element.removeEventListener("touchmove", blockTouch);
      element.removeEventListener("touchend", blockTouch);
    };
  };

  onMount(() => {
    const cleanupJoystick = bindTouchBlock(joystickBase);
    const cleanupAttack = bindTouchBlock(attackButton);
    const cleanupJump = bindTouchBlock(jumpButton);
    return () => {
      cleanupJoystick();
      cleanupAttack();
      cleanupJump();
    };
  });

  function onJumpDown(event: PointerEvent) {
    if (event.button !== 0 && event.pointerType === "mouse") {
      return;
    }

    input.pressJump();
    event.preventDefault();
  }

  function onJumpUp() {
    input.releaseJump();
  }

  function onAttackDown(event: PointerEvent) {
    if (event.button !== 0 && event.pointerType === "mouse") {
      return;
    }

    input.pressAttack();
    event.preventDefault();
  }

  function onAttackUp() {
    input.releaseAttack();
  }

  onDestroy(() => {
    input.reset();
  });
</script>

<div class="virtual-controls">
  <div class="left">
    <div
      class="joystick"
      bind:this={joystickBase}
      onpointerdown={onStickDown}
      onpointermove={onStickMove}
      onpointerup={onStickUp}
      onpointercancel={onStickUp}
      onpointerleave={onStickUp}
    >
      <div
        class="joystick-thumb"
        style={`transform: translate(-50%, -50%) translate(${stickOffset.x}px, ${stickOffset.y}px);`}
      ></div>
    </div>
  </div>
  <div class="right">
    <button
      class="attack"
      type="button"
      bind:this={attackButton}
      aria-label="Attack"
      onpointerdown={onAttackDown}
      onpointerup={onAttackUp}
      onpointercancel={onAttackUp}
      onpointerleave={onAttackUp}
    >
      Attack
    </button>
    <button
      class="jump"
      type="button"
      bind:this={jumpButton}
      aria-label="Jump"
      onpointerdown={onJumpDown}
      onpointerup={onJumpUp}
      onpointercancel={onJumpUp}
      onpointerleave={onJumpUp}
    >
      Jump
    </button>
  </div>
</div>

<style>
  .virtual-controls {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 3vh 4vw calc(6vh + env(safe-area-inset-bottom)) 4vw;
    pointer-events: none;
    z-index: 5;
  }

  .left,
  .right {
    display: flex;
    gap: clamp(12px, 3vw, 24px);
    align-items: flex-end;
    pointer-events: auto;
  }

  .joystick {
    width: clamp(96px, 26vw, 180px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid rgba(255, 255, 255, 0.3);
    position: relative;
    touch-action: none;
    user-select: none;
  }

  .joystick-thumb {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 45%;
    height: 45%;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
    border: 2px solid rgba(255, 255, 255, 0.7);
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.35);
  }

  .jump,
  .attack {
    width: clamp(80px, 20vw, 140px);
    aspect-ratio: 1;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.18);
    color: #ffffff;
    font-weight: 600;
    font-size: clamp(14px, 2.4vw, 18px);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    box-shadow: 0 12px 22px rgba(0, 0, 0, 0.35);
    touch-action: none;
  }

  .jump:active,
  .attack:active {
    background: rgba(255, 255, 255, 0.3);
  }

  @media (hover: hover) and (pointer: fine) {
    .virtual-controls {
      opacity: 0.8;
    }
  }
</style>
