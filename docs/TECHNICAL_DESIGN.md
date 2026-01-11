# CuteStation Technical Design

## Technology Stack
- **PixiJS v8**: 2D rendering for gameplay visuals.
- **Svelte 5**: UI overlays and menus.
- **TypeScript**: Game logic and tooling.
- **Tauri v2**: Desktop and mobile runtime.

## Runtime Architecture

```
src/
  lib/
    game/
      core/         # Game loop and input
      entities/     # Player, enemy, collectibles
      systems/      # Physics, combat, camera
      levels/       # Level data + runtime
      visuals/      # Parallax and environment art
    pages/          # Page flow (Splash/MainMenu/GamePlay)
```

## Rendering & View Scaling

- The design resolution is 1920x1080 (16:9).
- World rendering scales to fit the window while maintaining aspect ratio.
- Letterboxing uses `ProjectContent/UI/gameBackground.webp`.
- DOM overlays (menus, prompts) sit above the Pixi stage.
- Gameplay HUD uses a top bar for level title, HP, timer, and coins, plus a bottom controls hint bar (controller + keyboard).
- Page transitions fade out/in, and gameplay intro shows a zone logo overlay before controls unlock.
- Gameplay input is disabled until the intro sequence completes.

## Combat System

- Attacks use sprite animations and short hit windows.
- Hit windows are defined by the `attackHit` animation in the spritesheet JSON.
- Grounded moving attacks use `knight_runningAttacking`, aligned frame-for-frame with `knight_attacking`.
- Homing attacks are available in mid-air when a target is in range.
- Homing attacks spawn a blue silhouette trail along the dash path that can collect overlapping coins.
- Grounded attacks emit a slash projectile that travels along X and disappears on hit.
- Player hurt/death states lock inputs and drive hit/death animations; death triggers a fade-out restart.

## Input

- Keyboard, virtual touch controls, and gamepad input are merged each frame.
- Attack input is edge-triggered to avoid repeated presses.
- Level Editor supports pointer, touch (one-finger drag, two-finger pan), and gamepad input.
- Gamepad in Level Editor uses D-pad to focus UI controls and left stick to control the cursor.

## Level Data

- Enemies include `enemyType` (`static`/`patrol`) and optional `gravityEnabled`.

## Asset Pipeline

- `ProjectContent/` is the source of truth for game assets.
- `npm run build` copies `ProjectContent/` into `static/ProjectContent/`.
- Spritesheets use JSON atlases with named animations for segmentation.
