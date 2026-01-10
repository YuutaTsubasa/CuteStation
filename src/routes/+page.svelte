<script lang="ts">
  import { onMount } from "svelte";
  import { GamePlayPage } from "$lib/pages/GamePlayPage";
  import { LevelEditorPage } from "$lib/pages/LevelEditorPage";
  import { MainMenuPage } from "$lib/pages/MainMenuPage";
  import { PageManager } from "$lib/pages/PageManager";
  import { SplashScreenPage } from "$lib/pages/SplashScreenPage";
  import VirtualControls from "$lib/components/VirtualControls.svelte";
  import { VirtualInput } from "$lib/game/input/VirtualInput";
  import { assetManifest } from "$lib/game/assets/AssetManifest";
  import type { LevelEnemy } from "$lib/game/levels/LevelLoader";

  let status = $state("Initializing...");
  let currentPageId = $state("None");
  let pixiRoot: HTMLDivElement | null = null;
  let pageManager: PageManager | null = null;
  let gameplay: GamePlayPage | null = null;
  let pixiFrame: HTMLDivElement | null = null;
  let coinCount = $state(0);
  let coinTotal = $state(0);
  let levelClear = $state(false);
  let levelClearTimeout: number | null = null;
  let editor: LevelEditorPage | null = null;
  let gridEnabled = $state(true);
  let snapEnabled = $state(true);
  let gameLoading = $state(false);
  let showVirtualControls = $state(true);
  const virtualInput = new VirtualInput();
  const gameBackgroundUrl = assetManifest.ui.gameBackground;
  let selectedEnemy = $state<LevelEnemy | null>(null);
  let enemyType = $state("static");
  let enemyPatrolRange = $state(96);
  let enemyPatrolSpeed = $state(80);
  let enemyIdleDuration = $state(0.5);
  let enemyGravityEnabled = $state(true);

  let uiScale = $state(1);
  let uiOffsetX = $state(0);
  let uiOffsetY = $state(0);
  let uiTransform = $state("");
  const frameWidth = 1920;
  const frameHeight = 1080;

  function updateUiLayout() {
    if (!pixiRoot) {
      return;
    }
    const rect = pixiRoot.getBoundingClientRect();
    const scale = Math.min(rect.width / frameWidth, rect.height / frameHeight);
    const viewW = frameWidth * scale;
    const viewH = frameHeight * scale;
    uiScale = scale;
    uiOffsetX = (rect.width - viewW) / 2;
    uiOffsetY = (rect.height - viewH) / 2;
    uiTransform = `translate(${uiOffsetX}px, ${uiOffsetY}px) scale(${uiScale})`;
  }

  function updateStatus() {
    currentPageId = pageManager?.current?.id ?? "None";
    status = `Active page: ${currentPageId}`;
  }

  function resetGameplayHud() {
    coinCount = 0;
    coinTotal = 0;
    levelClear = false;
    gameLoading = true;
    showVirtualControls = false;
    if (levelClearTimeout) {
      window.clearTimeout(levelClearTimeout);
      levelClearTimeout = null;
    }
  }

  function goTo(id: string) {
    if (id === "GamePlay") {
      resetGameplayHud();
    }
    if (id === "LevelEditor") {
      gridEnabled = true;
      snapEnabled = true;
    }
    pageManager?.goTo(id);
    updateStatus();
    updateUiLayout();
    window.requestAnimationFrame(() => updateUiLayout());
  }

  function exportLevel() {
    void editor?.exportLevel();
  }

  function toggleGrid() {
    gridEnabled = editor?.toggleGrid() ?? gridEnabled;
  }

  function toggleSnap() {
    snapEnabled = editor?.toggleSnap() ?? snapEnabled;
  }

  onMount(() => {
    const manager = new PageManager();
    const splash = new SplashScreenPage();
    const menu = new MainMenuPage();
    gameplay = new GamePlayPage();
    const levelEditor = new LevelEditorPage();

    splash.setHost(pixiFrame);
    splash.setOnComplete(() => goTo("MainMenu"));
    menu.setHost(pixiFrame);
    menu.setOnNavigate((id) => goTo(id));
    gameplay.setHost(pixiFrame);
    gameplay.setOnRequestExit(() => goTo("MainMenu"));
    gameplay.setOnRequestPlaytestExit(() => goTo("LevelEditor"));
    gameplay.setOnCoinChange((count, total) => {
      coinCount = count;
      coinTotal = total;
    });
    gameplay.setOnLevelClear(() => {
      levelClear = true;
      status = "Level Clear";
      levelClearTimeout = window.setTimeout(() => {
        goTo("MainMenu");
      }, 1400);
    });
    gameplay.setOnReady(() => {
      gameLoading = false;
    });
    gameplay.setVirtualInput(virtualInput);

    levelEditor.setHost(pixiFrame);
    levelEditor.setOnRequestExit(() => goTo("MainMenu"));
    levelEditor.setOnRequestPlaytest(() => goTo("GamePlay"));
    levelEditor.setOnSelectionChange((selection) => {
      if (selection.type === "enemy") {
        selectedEnemy = selection.enemy;
        enemyType = selection.enemy.enemyType ?? "static";
        enemyPatrolRange = selection.enemy.patrolRange ?? 96;
        enemyPatrolSpeed = selection.enemy.patrolSpeed ?? 80;
        enemyIdleDuration = selection.enemy.idleDuration ?? 0.5;
        enemyGravityEnabled = selection.enemy.gravityEnabled ?? true;
        return;
      }
      selectedEnemy = null;
    });
    editor = levelEditor;

    manager.register(splash);
    manager.register(menu);
    manager.register(gameplay);
    manager.register(levelEditor);

    pageManager = manager;
    goTo("SplashScreen");
    updateUiLayout();
    const resizeHandler = () => updateUiLayout();
    window.addEventListener("resize", resizeHandler);

    const handleKeydown = () => {
      if (currentPageId === "GamePlay") {
        showVirtualControls = false;
      }
    };

    const handlePointerDown = () => {
      if (currentPageId === "GamePlay") {
        showVirtualControls = true;
      }
    };

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("resize", resizeHandler);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("pointerdown", handlePointerDown);
      resetGameplayHud();
      gameplay?.setVirtualInput(null);
      gameplay?.onExit();
      levelEditor.onExit();
    };
  });
</script>

<main class="container">
  <div
    class="stage"
    bind:this={pixiRoot}
    style={`background-image: url("${gameBackgroundUrl}")`}
  >
    <div class="stage-frame" bind:this={pixiFrame} style={`transform: ${uiTransform};`}></div>
    <div class="stage-ui" style={`transform: ${uiTransform};`}>
      {#if currentPageId === "GamePlay"}
        <div class="hud">Coins {coinCount}/{coinTotal}</div>
        {#if gameLoading}
          <div class="stage-overlay">
            <div class="panel">Loading...</div>
          </div>
        {/if}
        {#if levelClear}
          <div class="stage-overlay">
            <div class="panel">Level Clear</div>
          </div>
        {/if}
      {:else if currentPageId === "LevelEditor"}
        <div class="editor-toolbar">
          <button class="action" type="button" on:click={() => editor?.addSolid()}
            >Add Solid</button
          >
          <button class="action" type="button" on:click={() => editor?.addCoin()}
            >Add Coin</button
          >
          <button class="action" type="button" on:click={() => editor?.addEnemy()}
            >Add Enemy</button
          >
          <button class="action" type="button" on:click={() => editor?.deleteSelected()}
            >Delete</button
          >
          <button
            class="action"
            type="button"
            data-active={gridEnabled}
            on:click={toggleGrid}
            >Grid</button
          >
          <button
            class="action"
            type="button"
            data-active={snapEnabled}
            on:click={toggleSnap}
            >Snap</button
          >
          <button class="action" type="button" on:click={() => editor?.resizeWorld(200, 0)}
            >Width +</button
          >
          <button class="action" type="button" on:click={() => editor?.resizeWorld(-200, 0)}
            >Width -</button
          >
          <button class="action" type="button" on:click={() => editor?.resizeWorld(0, 200)}
            >Height +</button
          >
          <button class="action" type="button" on:click={() => editor?.resizeWorld(0, -200)}
            >Height -</button
          >
          <button class="action" type="button" on:click={() => editor?.playTest()}
            >Play Test</button
          >
          <button class="action" type="button" on:click={exportLevel}
            >Export Level</button
          >
          <button class="action" type="button" on:click={() => goTo("MainMenu")}
            >Back</button
          >
        </div>
        {#if selectedEnemy}
          <div class="editor-panel">
            <div class="panel-title">Enemy Settings</div>
            <label class="panel-row">
              <span>Type</span>
              <select
                value={enemyType}
                on:change={(event) => {
                  const value = (event.target as HTMLSelectElement).value;
                  enemyType = value;
                  editor?.updateSelectedEnemy({ enemyType: value as "static" | "patrol" });
                }}
              >
                <option value="static">Static</option>
                <option value="patrol">Patrol</option>
              </select>
            </label>
            <label class="panel-row">
              <span>Patrol Range</span>
              <input
                type="number"
                value={enemyPatrolRange}
                min="0"
                step="1"
                disabled={enemyType !== "patrol"}
                on:change={(event) => {
                  const value = Number((event.target as HTMLInputElement).value);
                  enemyPatrolRange = value;
                  editor?.updateSelectedEnemy({ patrolRange: value });
                }}
              />
            </label>
            <label class="panel-row">
              <span>Patrol Speed</span>
              <input
                type="number"
                value={enemyPatrolSpeed}
                min="0"
                step="1"
                disabled={enemyType !== "patrol"}
                on:change={(event) => {
                  const value = Number((event.target as HTMLInputElement).value);
                  enemyPatrolSpeed = value;
                  editor?.updateSelectedEnemy({ patrolSpeed: value });
                }}
              />
            </label>
            <label class="panel-row">
              <span>Idle Duration</span>
              <input
                type="number"
                value={enemyIdleDuration}
                min="0"
                step="0.1"
                on:change={(event) => {
                  const value = Number((event.target as HTMLInputElement).value);
                  enemyIdleDuration = value;
                  editor?.updateSelectedEnemy({ idleDuration: value });
                }}
              />
            </label>
            <label class="panel-row">
              <span>Gravity</span>
              <input
                type="checkbox"
                checked={enemyGravityEnabled}
                on:change={(event) => {
                  const value = (event.target as HTMLInputElement).checked;
                  enemyGravityEnabled = value;
                  editor?.updateSelectedEnemy({ gravityEnabled: value });
                }}
              />
            </label>
          </div>
        {/if}
        <div class="editor-hint">
          Mouse: Drag to move. Shift + drag to resize. Space/right click + drag to pan.
          <br />
          Touch: One finger drag to move. Two fingers to pan.
          <br />
          Gamepad: Left stick move cursor. A drag/select. X add solid. Y add coin. LB add enemy.
          B delete. Right stick pans.
        </div>
      {:else}
        <!-- Main menu UI is rendered by MainMenuPage in Pixi. -->
      {/if}
    </div>
    {#if currentPageId === "GamePlay" && showVirtualControls}
      <VirtualControls input={virtualInput} />
    {/if}
  </div>
</main>

<style>
@font-face {
  font-family: "Gabarito";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/ProjectContent/Fonts/Gabarito-Regular.ttf") format("truetype");
}

@font-face {
  font-family: "Gabarito";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("/ProjectContent/Fonts/Gabarito-Bold.ttf") format("truetype");
}

@font-face {
  font-family: "Noto Sans TC";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/ProjectContent/Fonts/NotoSansTC-Regular.ttf") format("truetype");
}

@font-face {
  font-family: "Noto Sans TC";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("/ProjectContent/Fonts/NotoSansTC-Bold.ttf") format("truetype");
}

:global(body),
:global(button),
:global(input),
:global(textarea),
:global(select) {
  font-family: "Gabarito", "Noto Sans TC", sans-serif;
}

:root {
  font-family: "Gabarito", "Noto Sans TC", sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;

  color: #0f0f0f;
  background-color: #f6f6f6;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

.container {
  margin: 0;
  width: 100%;
  height: 100vh;
}

.stage {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  position: relative;
  background: #0b0b0b;
  background-size: cover;
  background-position: center;
}

.stage-frame {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  transform-origin: top left;
  background: #0b0b0b;
  border: 2px solid #1f1f1f;
  box-sizing: border-box;
  overflow: hidden;
  z-index: 2;
}

.stage-frame :global(canvas) {
  width: 100%;
  height: 100%;
  display: block;
  position: relative;
  z-index: 2;
}

.stage-ui {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  transform-origin: top left;
  pointer-events: none;
  z-index: 3;
}

:global(.pressStart) {
  position: absolute;
  left: 50%;
  bottom: 18%;
  transform: translateX(-50%);
  background: #0007cd;
  color: #ffffff;
  width: 80%;
  text-align: center;
  font-weight: 700;
  line-height: 0.9;
  font-size: 1.6rem;
  padding: 12px 0;
  border-radius: 0;
  letter-spacing: 2px;
  transition: opacity 0.2s ease;
  z-index: 4;
}

:global(.pressStartHidden) {
  opacity: 0;
  pointer-events: none;
}

:global(.slowFlicker) {
  animation: slowFlicker 2.5s ease-in-out infinite;
}

@keyframes slowFlicker {
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.7;
  }
}

.hud {
  position: absolute;
  top: 24px;
  left: 24px;
  padding: 12px 20px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  font-size: 28px;
}

.editor-toolbar {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  pointer-events: auto;
}

.editor-hint {
  position: absolute;
  bottom: 24px;
  left: 24px;
  padding: 12px 20px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  font-size: 24px;
  pointer-events: auto;
}

.editor-panel {
  position: absolute;
  top: 120px;
  right: 24px;
  width: 360px;
  padding: 16px 20px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  display: grid;
  gap: 12px;
  pointer-events: auto;
}

.panel-title {
  font-size: 24px;
  font-weight: 700;
}

.panel-row {
  display: grid;
  grid-template-columns: 1fr 140px;
  align-items: center;
  gap: 12px;
  font-size: 20px;
}

.panel-row input,
.panel-row select {
  padding: 8px 10px;
  border-radius: 10px;
  border: none;
  font-size: 18px;
}

.stage-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.panel {
  padding: 32px 40px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.88);
  color: #111111;
  font-size: 28px;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.2);
  display: grid;
  gap: 24px;
  pointer-events: auto;
}

.action {
  padding: 16px 32px;
  border-radius: 999px;
  border: none;
  background: #1f1f1f;
  color: #ffffff;
  font-weight: 600;
  font-size: 28px;
  cursor: pointer;
  pointer-events: auto;
}

.action[data-active="true"] {
  background: #3b7cff;
}

.action[data-active="true"]:hover {
  background: #2f64d2;
}

.action:hover {
  background: #343434;
}

h2 {
  margin: 0;
  font-size: 40px;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #f6f6f6;
    background-color: #2f2f2f;
  }

  .stage-frame {
    border-color: #343434;
  }

  .panel {
    background: rgba(17, 17, 17, 0.82);
    color: #f6f6f6;
  }
}

:global(html),
:global(body) {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

:global(#svelte) {
  width: 100%;
  height: 100%;
}
</style>
