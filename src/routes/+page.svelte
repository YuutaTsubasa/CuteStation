<script lang="ts">
  import { onMount } from "svelte";
  import { GamePlayPage } from "$lib/pages/GamePlayPage";
  import { LevelEditorPage } from "$lib/pages/LevelEditorPage";
  import { MainMenuPage } from "$lib/pages/MainMenuPage";
  import { PageManager } from "$lib/pages/PageManager";
  import { SplashScreenPage } from "$lib/pages/SplashScreenPage";
  import VirtualControls from "$lib/components/VirtualControls.svelte";
  import { VirtualInput } from "$lib/game/input/VirtualInput";

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
  let menuEntries = $state<{ id: string; label: string }[]>([]);
  let editor: LevelEditorPage | null = null;
  let gridEnabled = $state(true);
  let snapEnabled = $state(true);
  let gameLoading = $state(false);
  let showVirtualControls = $state(true);
  const virtualInput = new VirtualInput();

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
    showVirtualControls = true;
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

    menuEntries = menu.entries;

    splash.setHost(pixiFrame);
    menu.setHost(pixiFrame);
    gameplay.setHost(pixiFrame);
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
    gameplay.setVirtualInput(virtualInput);

    levelEditor.setHost(pixiFrame);
    levelEditor.setOnRequestExit(() => goTo("MainMenu"));
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

    // TODO: replace with SplashScreenPage-driven timing in Phase 4.
    const splashTimeout = window.setTimeout(() => {
      goTo("MainMenu");
    }, 1200);

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
      window.clearTimeout(splashTimeout);
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
  <div class="stage" bind:this={pixiRoot}>
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
          Drag to move. Shift + drag to resize. Space/right click + drag to pan. Grid/Snap
          toggles.
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
    {#if currentPageId === "GamePlay" && showVirtualControls}
      <VirtualControls input={virtualInput} />
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
  background-image: url("/ProjectContent/UI/gameBackground.png");
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
}

.stage-frame :global(canvas) {
  width: 100%;
  height: 100%;
  display: block;
}

.stage-ui {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  transform-origin: top left;
  pointer-events: none;
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
