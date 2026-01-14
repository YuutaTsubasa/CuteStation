<script lang="ts">
  import { assetManifest } from "$lib/game/assets/AssetManifest";
  import { audioManager } from "$lib/game/audio/AudioManager";

  export let primaryTitle = "";
  export let secondaryTitle = "";
  export let onHeightChange: ((height: number) => void) | undefined;
  export let onBack: (() => void) | undefined;

  let height = 0;
  $: onHeightChange?.(height);

  const handleBack = () => {
    audioManager.playSfx(assetManifest.audio.sfx.confirm);
    onBack?.();
  };
</script>

<div class="topbar" bind:clientHeight={height}>
  <div class="topbar-content">
    <button class="backButton" on:click={handleBack} type="button">{"<-"}</button>
    <h1 class="topbarTitle">
      {primaryTitle}
      <span class="topbarSubtitle">{secondaryTitle}</span>
    </h1>
  </div>
</div>

<style>
  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.9) 0%,
      rgba(255, 255, 255, 0.9) 75%,
      transparent 100%
    );
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
    z-index: 1000;
    box-sizing: border-box;
  }

  .topbar-content {
    width: 80%;
    margin: 0 auto;
    display: flex;
    align-items: center;
  }

  .backButton {
    background-color: #000000;
    color: #ffffff;
    border: none;
    font-size: 1.6rem;
    padding: 0.6rem 2.6rem;
    min-width: 84px;
    min-height: 48px;
    border-radius: 12px;
    box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    margin-right: 1rem;
    cursor: pointer;
  }

  @media (max-width: 900px) {
    .topbar-content {
      width: 92%;
    }

    .backButton {
      font-size: 1.8rem;
      padding: 0.8rem 3rem;
      min-width: 96px;
      min-height: 56px;
    }
  }

  .backButton:global(.navFocused),
  .backButton:hover,
  .backButton:active {
    background-color: #ffffff;
    color: #000000;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .topbarTitle {
    font-size: 2rem;
    color: #1e293b;
    font-family: "Gabarito", "Noto Serif TC", "Noto Sans TC", sans-serif;
    font-weight: 700;
  }

  .topbarSubtitle {
    font-size: 1rem;
    margin-left: 0.5rem;
    color: #666666;
    font-family: "Noto Serif TC", "Noto Sans TC", sans-serif;
    font-weight: 400;
  }
</style>
