# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Svelte 5 frontend (routes in `src/routes/`, app shell in `src/app.html`).
- `src-tauri/`: Rust backend and Tauri config (`src-tauri/src/`, `src-tauri/tauri.conf.json`).
- `static/`: Static assets served by the frontend.
- `docs/`: Game and technical design docs (`docs/GAME_DESIGN.md`, `docs/TECHNICAL_DESIGN.md`).
- `src/lib/game/view/ResolutionManager.ts`: 16:9 design resolution (1920x1080) constants for view sizing.
- `ProjectContent/Fonts/`: UI fonts used by the Svelte overlays and Pixi text.

## Build, Test, and Development Commands
- `npm run tauri dev`: Desktop app with hot reload (Tauri + Vite).
- `npm run dev`: Frontend-only Vite dev server.
- `npm run tauri android dev`: Android dev build (device/emulator required).
- `npm run tauri ios dev`: iOS dev build (macOS + simulator required).
- `npm run build`: Frontend production build.
- `npm run tauri build`: Desktop production bundle.
- `npm run tauri android build`: Android APK/AAB build.
- `npm run tauri ios build`: iOS build (local only, signed if configured).
- `npm run check`: Svelte type checking via `svelte-check`.

## Coding Style & Naming Conventions
- Indentation: 2 spaces in Svelte/TypeScript, 4 spaces in Rust.
- File naming: match SvelteKit conventions (`+page.svelte`, `+layout.ts`).
- Rust commands: use `#[tauri::command]` and register in `src-tauri/src/lib.rs`.
- No formatter or linter is configured; keep changes consistent with surrounding code.

## Convention Checks
- Run `npm run convention:check` to generate reports and fail on error-level issues.
- Run `npm run convention:report` to generate reports without failing the command.
- Reports are written to `reports/convention-report.json` and `reports/convention-report.md`.
- Details live in `docs/conventions.md`.

## Current MVP Progress
- Phase 1: PixiJS integration and page system skeleton complete.
- Phase 2: GamePlayPage Pixi lifecycle, MainMenu -> GamePlay flow, and placeholder render complete.
- Phase 3: Player placeholder with keyboard movement/jump and back-to-menu escape complete.
- Phase 4: Basic platform collisions and horizontal camera follow complete.
- Phase 5: Knight sprites, scale pass, and camera bounds refinements complete.
- Phase 6: JSON-defined level data with coins/goal wiring complete.
- Phase 7: Level Editor v0 with grid/snap/pan and export complete.
- Phase 8: Mobile virtual controls overlay (joystick + jump) complete.
- Phase 9: Knight combat animations (attack, hit, dead, running attack) complete.
- Phase 10: Level editor enemy placement + touch/gamepad editing complete.

## Testing Guidelines
- There are no automated tests yet. Use `npm run check` before PRs.
- If you add tests, document the framework and add a runnable script in `package.json`.

## Commit & Pull Request Guidelines
- Commit messages follow a short, imperative summary (e.g., "Fix GitHub Actions: ...").
- PRs should include: what changed, how to verify locally, and platform notes if relevant.
- Include screenshots or screen recordings for UI changes.

## Architecture Notes
- Frontend calls Rust commands via Tauri IPC (`invoke()` in TS, `#[tauri::command]` in Rust).
- SPA mode is enabled; SSR is off. Static build output is served by Tauri.
- Game rendering targets a 1920x1080 design frame and scales to fit the window; the letterbox area uses `ProjectContent/UI/gameBackground.webp`.
- Asset paths should be sourced from `src/lib/game/assets/assetManifest.json`.
- GamePlay centers the camera at player spawn and hides the world until player assets finish loading.
- Main menu video background and Press-to-Start prompt are DOM overlays inside the stage frame.
- Grounded attacks emit a slash projectile; homing attacks remain air-only.
- Attack hit windows are defined by the `attackHit` animation inside `knight_attacking.json` and `knight_runningAttacking.json`.
- Gameplay HUD shows level title, HP bar, timer, and coins in a top bar, with control hints at the bottom.
- Control hints show both controller and keyboard icons in the bottom bar.
- Page transitions fade out/in; gameplay intro uses a dark overlay + zone logo before controls unlock.
- Gameplay input is locked while the intro overlay/logo sequence plays.
- Enemy entries support `enemyType` (`static`/`patrol`) and `gravityEnabled` to toggle falling behavior.
