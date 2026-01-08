<script lang="ts">
  import { onMount } from "svelte";
  import { GamePlayPage } from "$lib/pages/GamePlayPage";
  import { LevelEditorPage } from "$lib/pages/LevelEditorPage";
  import { MainMenuPage } from "$lib/pages/MainMenuPage";
  import { PageManager } from "$lib/pages/PageManager";
  import { SplashScreenPage } from "$lib/pages/SplashScreenPage";

  let status = $state("Initializing...");
  let currentPageId = $state("None");
  let pixiRoot: HTMLDivElement | null = null;
  let pageManager: PageManager | null = null;
  let coinCount = $state(0);
  let coinTotal = $state(0);
  let levelClear = $state(false);
  let levelClearTimeout: number | null = null;
  let menuEntries = $state<{ id: string; label: string }[]>([]);
  let editor: LevelEditorPage | null = null;
  let gridEnabled = $state(true);
  let snapEnabled = $state(true);
  let gameLoading = $state(false);

  function updateStatus() {
    currentPageId = pageManager?.current?.id ?? "None";
    status = `Active page: ${currentPageId}`;
  }

  function resetGameplayHud() {
    coinCount = 0;
    coinTotal = 0;
    levelClear = false;
    gameLoading = true;
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
    const gameplay = new GamePlayPage();
    const levelEditor = new LevelEditorPage();

    menuEntries = menu.entries;

    gameplay.setHost(pixiRoot);
    gameplay.setOnRequestExit(() => goTo("MainMenu"));
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

    levelEditor.setHost(pixiRoot);
    levelEditor.setOnRequestExit(() => goTo("MainMenu"));
    editor = levelEditor;

    manager.register(splash);
    manager.register(menu);
    manager.register(gameplay);
    manager.register(levelEditor);

    pageManager = manager;
    goTo("SplashScreen");

    // TODO: replace with SplashScreenPage-driven timing in Phase 4.
    const splashTimeout = window.setTimeout(() => {
      goTo("MainMenu");
    }, 1200);

    return () => {
      window.clearTimeout(splashTimeout);
      resetGameplayHud();
      gameplay.onExit();
      levelEditor.onExit();
    };
  });
</script>

<main class="container">
  <h1>CuteStation</h1>
  <p>{status}</p>
  <div class="stage" bind:this={pixiRoot}>
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
        <button class="action" type="button" on:click={exportLevel}
          >Export Level</button
        >
        <button class="action" type="button" on:click={() => goTo("MainMenu")}
          >Back</button
        >
      </div>
      <div class="editor-hint">
        Drag to move. Shift + drag to resize. Space/right click + drag to pan. Grid/Snap toggles.
      </div>
    {:else}
      <div class="stage-overlay">
        <div class="panel">
          <h2>{currentPageId}</h2>
          {#if currentPageId === "MainMenu"}
            {#each menuEntries as entry}
              <button class="action" type="button" on:click={() => goTo(entry.id)}
                >{entry.label}</button
              >
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
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
  padding-top: 10vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.stage {
  width: min(90vw, 960px);
  height: 540px;
  margin: 24px auto 0;
  border: 1px solid #1f1f1f;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  background: #0b0b0b;
}

.hud {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  font-size: 14px;
}

.editor-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.editor-hint {
  position: absolute;
  bottom: 12px;
  left: 12px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  font-size: 12px;
}

.stage-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.panel {
  padding: 16px 20px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  color: #111111;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
  display: grid;
  gap: 12px;
  pointer-events: auto;
}

.action {
  padding: 8px 16px;
  border-radius: 999px;
  border: none;
  background: #1f1f1f;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
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

h1 {
  text-align: center;
}

h2 {
  margin: 0;
  font-size: 20px;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #f6f6f6;
    background-color: #2f2f2f;
  }

  .stage {
    border-color: #343434;
  }

  .panel {
    background: rgba(17, 17, 17, 0.82);
    color: #f6f6f6;
  }
}
</style>
