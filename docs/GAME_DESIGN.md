# CuteStation Game Design Document

## High-Level Overview
- **Genre:** 2D action platformer
- **Style:** Cute fantasy with crisp, readable silhouettes
- **Target Platforms:** Desktop and mobile (via Tauri)

## Core Loop
1. Enter a level.
2. Move, jump, and fight enemies.
3. Collect coins and reach the goal.
4. Repeat with tougher layouts and enemy patterns.

## Player Actions

### Movement
- Left/right movement with optional run speed.
- Jump and fall with mid-air control.

### Combat
- Ground attack: melee strike with a short hit window.
- Ground attack also emits a short-range slash wave projectile.
- Homing attack: mid-air dash to a target (requires a valid homing target).
- Attack hit window: active on attack frames 8-9; the rest of the animation is visual only.
- Moving attacks: when grounded and moving, use `knight_runningAttacking` to keep the legs in motion.

## Level Structure
- White Palace world is the current focus (Level 1-1).
- Levels include solids, coins, goal, and enemy placements.
- Each level targets 5 collectible coins.

## Enemies
- Types: `static` (idle in place) and `patrol` (moves within a range).
- Enemies can disable gravity for floating or stationary placements.

## Controls

### Keyboard
- Move: Arrow keys or A/D
- Jump: Space
- Attack: J or K
- Pause/Exit: Escape

### Touch (Mobile)
- Left virtual joystick: move
- Right buttons: jump and attack

### HUD
- Top bar shows level title, HP, timer, and coins.
- Bottom bar shows controller + keyboard mappings.

## Tools

- Level Editor v0: grid, snap, pan, and JSON export.
