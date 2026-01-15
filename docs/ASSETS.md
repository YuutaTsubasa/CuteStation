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
- `ProjectContent/Enemies/{enemyId}/`
  - Example: `ProjectContent/Enemies/slime/`
- `ProjectContent/Enemies/enemyConfig.json`
- `ProjectContent/UI/`
  - Example: `ProjectContent/UI/gameBackground.webp`
- `ProjectContent/Fonts/`
  - Example: `ProjectContent/Fonts/Gabarito-Regular.ttf`
- `ProjectContent/Localization/`
  - Example: `ProjectContent/Localization/localization.csv`

## Level Data v0 Notes

- `world.width`/`world.height` define the editable bounds (used by editor grid and camera clamps).
- `spawn`, `solids`, `coins`, `goal` positions are expressed in level coordinates.
- `enemies` entries reference `enemyId` values defined in `ProjectContent/Enemies/enemyConfig.json`.

## Level Visuals

Level visuals live under `ProjectContent/Levels/{world}/visuals/`.

### Parallax Backgrounds

- `background/far.webp`: furthest layer, non-tiled, subtle parallax (e.g., 0.2).
- `background/mid.webp`: mid layer, tiled, medium parallax (e.g., 0.5).
- `background/near.webp`: near layer, tiled, stronger parallax (optional).
- Toggle near with `visuals/visuals.json` (`layers.nearEnabled`).
- Configure parallax factors and `groundHeight` in `visuals/visuals.json`.

### Terrain Tiles

- `terrain/platformTile.webp`: tiled to fill solid rectangles.
- `visuals/visuals.json`: per-level visuals settings (e.g., groundHeight, parallax).

### Zone Logos

- `visuals/logos/zone1.webp`: zone intro logo.

## UI Assets

- `ProjectContent/UI/gameBackground.webp`: letterbox background image.
- `ProjectContent/UI/creatorLogo.webp`: splash logo.
- `ProjectContent/UI/gameLogo.webp`: main menu logo.
- `ProjectContent/UI/backgroundWhite.webp`: popup background image.
- `ProjectContent/UI/backgroundWhiteButton.webp`: UI button background image.
- `ProjectContent/UI/mainMenuBackground.mp4`: looping main menu background video.

## Localization

- `ProjectContent/Localization/localization.csv`: translation table with `key` + locale columns.

## Fonts

- `ProjectContent/Fonts/Gabarito-Regular.ttf`
- `ProjectContent/Fonts/Gabarito-Bold.ttf`
- `ProjectContent/Fonts/NotoSansTC-Regular.ttf`
- `ProjectContent/Fonts/NotoSansTC-Bold.ttf`
- `ProjectContent/Fonts/NotoSerifTC-Regular.ttf`
- `ProjectContent/Fonts/NotoSerifTC-Bold.ttf`

## Audio Conventions

- `ProjectContent/Audio/BGM/`: background music grouped by category (e.g., `Levels/whitePalace/default.mp3`).
- `ProjectContent/Audio/BGM/Settings/default.mp3`: settings screen background music.
- `ProjectContent/Audio/SFX/`: sound effects grouped by usage (e.g., `UI/`, `Player/`, `Enemies/`).
- Prefer descriptive SFX names (e.g., `footstep_01.mp3`, `attack_swing_01.mp3`, `coin_pickup_01.mp3`).

## Web Build Notes

- Frontend builds copy `ProjectContent/` into `static/ProjectContent/` so assets resolve in web builds.

## WebP Conversion

- Use `npm run assets:webp` to convert PNG/JPG assets under `ProjectContent/` to WebP.
- Options: `--root <path>` to change the source folder, `--quality <n>` (default 82), `--force` to overwrite existing WebP files.
- The converter uses the `sharp` npm package, so it works on Windows/macOS/Linux without `cwebp`.
- The script updates `src/lib/game/assets/assetManifest.json` and spritesheet JSON to point at WebP files, then removes the original PNG/JPG files.

## Asset Manifest

- Asset lookups should go through `src/lib/game/assets/assetManifest.json`.

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
- `ProjectContent/Characters/knight/knight_idle.webp` + `.json`
- `ProjectContent/Characters/knight/knight_walking.webp` + `.json`
- `ProjectContent/Characters/knight/knight_running.webp` + `.json`
- `ProjectContent/Characters/knight/knight_attacking.webp` + `.json`
- `ProjectContent/Characters/knight/knight_runningAttacking.webp` + `.json`
- `ProjectContent/Characters/knight/knight_hit.webp` + `.json`
- `ProjectContent/Characters/knight/knight_dead.webp` + `.json`
- `ProjectContent/Characters/knight/knight_jumping.webp` + `.json`

## Enemy Assets

### Slime

Files available:
- `ProjectContent/Enemies/slime/slime_running.webp` + `.json`
- `ProjectContent/Enemies/slime/slime_hit.webp` + `.json`

### Crystal

Files available:
- `ProjectContent/Enemies/crystal/crystal_idle.webp` + `.json`
