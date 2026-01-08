# Assets

## ProjectContent Purpose

`ProjectContent/` stores exported game-ready assets (spritesheets, audio, level files). It is the canonical location checked by convention tooling and should contain content that ships with the game.

## Folder Structure

Use a consistent hierarchy so tools and scripts can find assets:

- `ProjectContent/Characters/{characterId}/`
  - Example: `ProjectContent/Characters/knight/`
- `ProjectContent/Levels/{world}/{levelId}.json`
  - Example: `ProjectContent/Levels/whitePalace/1-1.json`

## Level Data v0 Notes

- `world.width`/`world.height` define the editable bounds (used by editor grid and camera clamps).
- `spawn`, `solids`, `coins`, `goal` positions are expressed in level coordinates.

## Naming Conventions

- Prefer lowerCamelCase or PascalCase for files and folders.
- Keep names stable and action-driven (e.g., `Idle`, `Walking`, `Running`, `Jumping`).
- Avoid hyphens and underscores.

## Animation Usage Rules

- `Idle`, `Walking`, `Running` are looping animations.
- `Jumping` is segmented via spritesheet JSON `animations` (e.g., `jumpUp`, `jumpHold`, `jumpFall`, `jumpLand`).
- Use a foot-center anchor/pivot so the character stands on the same ground line across actions.

## Current Character Assets

### Knight

Actions available:
- Idle
- Walking
- Running
- Jumping

Files available:
- `ProjectContent/Characters/knight/knight_idle.png` + `.json`
- `ProjectContent/Characters/knight/knight_walking.png` + `.json`
- `ProjectContent/Characters/knight/knight_running.png` + `.json`
- `ProjectContent/Characters/knight/knight_jumping.png` + `.json`
