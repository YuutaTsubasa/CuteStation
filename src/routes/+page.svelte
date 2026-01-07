<script lang="ts">
  import { onMount } from "svelte";
  import { GamePlayPage } from "$lib/pages/GamePlayPage";
  import { MainMenuPage } from "$lib/pages/MainMenuPage";
  import { PageManager } from "$lib/pages/PageManager";
  import { SplashScreenPage } from "$lib/pages/SplashScreenPage";

  let status = $state("Initializing...");
  let currentPageId = $state("None");
  let pixiRoot: HTMLDivElement | null = null;
  let pageManager: PageManager | null = null;

  function updateStatus() {
    currentPageId = pageManager?.current?.id ?? "None";
    status = `Active page: ${currentPageId}`;
  }

  function goTo(id: string) {
    pageManager?.goTo(id);
    updateStatus();
  }

  onMount(() => {
    const manager = new PageManager();
    const splash = new SplashScreenPage();
    const menu = new MainMenuPage();
    const gameplay = new GamePlayPage();

    gameplay.setHost(pixiRoot);
    gameplay.setOnRequestExit(() => goTo("MainMenu"));

    manager.register(splash);
    manager.register(menu);
    manager.register(gameplay);

    pageManager = manager;
    goTo("SplashScreen");

    // TODO: replace with SplashScreenPage-driven timing in Phase 4.
    const splashTimeout = window.setTimeout(() => {
      goTo("MainMenu");
    }, 1200);

    return () => {
      window.clearTimeout(splashTimeout);
      gameplay.onExit();
    };
  });
</script>

<main class="container">
  <h1>CuteStation</h1>
  <p>{status}</p>
  <div class="stage" bind:this={pixiRoot}>
    {#if currentPageId !== "GamePlay"}
      <div class="stage-overlay">
        <div class="panel">
          <h2>{currentPageId}</h2>
          <p>Placeholder UI for Phase 1.</p>
          {#if currentPageId === "MainMenu"}
            <button class="action" type="button" on:click={() => goTo("GamePlay")}
              >Start Game</button
            >
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
