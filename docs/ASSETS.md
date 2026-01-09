# Assets

## ProjectContent Purpose

`ProjectContent/` stores exported game-ready assets (spritesheets, audio, level files). It is the canonical location checked by convention tooling and should contain content that ships with the game.

## Folder Structure

Use a consistent hierarchy so tools and scripts can find assets:

- `ProjectContent/Characters/{characterId}/`
  - Example: `ProjectContent/Characters/knight/`
- `ProjectContent/Levels/{world}/{levelId}.json`
  - Example: `ProjectContent/Levels/whitePalace/1-1.json`
- `ProjectContent/Levels/{world}/visuals/`
  - Example: `ProjectContent/Levels/whitePalace/visuals/`
- `ProjectContent/UI/`
  - Example: `ProjectContent/UI/gameBackground.png`
- `ProjectContent/Fonts/`
  - Example: `ProjectContent/Fonts/Gabarito-Regular.ttf`

## Level Data v0 Notes

- `world.width`/`world.height` define the editable bounds (used by editor grid and camera clamps).
- `spawn`, `solids`, `coins`, `goal` positions are expressed in level coordinates.

## Level Visuals

Level visuals live under `ProjectContent/Levels/{world}/visuals/`.

### Parallax Backgrounds

- `background/far.png`: furthest layer, non-tiled, subtle parallax (e.g., 0.2).
- `background/mid.png`: mid layer, tiled, medium parallax (e.g., 0.5).
- `background/near.png`: near layer, tiled, stronger parallax (optional).
- Toggle near with `visuals/visuals.json` (`layers.nearEnabled`).
- Configure parallax factors and `groundHeight` in `visuals/visuals.json`.

### Terrain Tiles

- `terrain/platformTile.png`: tiled to fill solid rectangles.
- `visuals/visuals.json`: per-level visuals settings (e.g., groundHeight, parallax).

## UI Assets

- `ProjectContent/UI/gameBackground.png`: letterbox background image.
- `ProjectContent/UI/producerLogo.png`: splash logo.
- `ProjectContent/UI/gameLogo.png`: main menu logo.
- `ProjectContent/UI/mainMenuBackground.mp4`: looping main menu background video.

## Fonts

- `ProjectContent/Fonts/Gabarito-Regular.ttf`
- `ProjectContent/Fonts/Gabarito-Bold.ttf`
- `ProjectContent/Fonts/NotoSansTC-Regular.ttf`
- `ProjectContent/Fonts/NotoSansTC-Bold.ttf`

## Audio Conventions

- `ProjectContent/Audio/BGM/`: background music grouped by category (e.g., `Levels/whitePalace/default.mp3`).
- `ProjectContent/Audio/SFX/`: sound effects grouped by usage (e.g., `UI/`, `Player/`, `Enemies/`).

## Web Build Notes

- Frontend builds copy `ProjectContent/` into `static/ProjectContent/` so assets resolve in web builds.

## Naming Conventions

- Prefer `lower_snake_case` for files and folders.
- Keep names stable and action-driven (e.g., `idle`, `walking`, `running`, `jumping`).

## Animation Usage Rules

- `Idle`, `Walking`, `Running` are looping animations.
- `Jumping` is segmented via spritesheet JSON `animations` (e.g., `jumpUp`, `jumpHold`, `jumpFall`, `jumpLand`).
- `Attack` hit windows are defined via an `attackHit` animation list in the spritesheet JSON.
- Use a foot-center anchor/pivot so the character stands on the same ground line across actions.

## Current Character Assets

### Knight

Actions available:
- Idle
- Walking
- Running
- Attacking
- Running Attacking
- Hit
- Dead
- Jumping

Files available:
- `ProjectContent/Characters/knight/knight_idle.png` + `.json`
- `ProjectContent/Characters/knight/knight_walking.png` + `.json`
- `ProjectContent/Characters/knight/knight_running.png` + `.json`
- `ProjectContent/Characters/knight/knight_attacking.png` + `.json`
- `ProjectContent/Characters/knight/knight_runningAttacking.png` + `.json`
- `ProjectContent/Characters/knight/knight_hit.png` + `.json`
- `ProjectContent/Characters/knight/knight_dead.png` + `.json`
- `ProjectContent/Characters/knight/knight_jumping.png` + `.json`
