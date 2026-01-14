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
  <button class="backButton" on:click={handleBack} type="button" aria-label="Back">
    <svg class="backIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5 6 12l8 7v-4h6v-6h-6V5z" />
    </svg>
  </button>
  <h1 class="topbarTitle">
    {primaryTitle}
    <span class="topbarSubtitle">{secondaryTitle}</span>
  </h1>
</div>

<style>
  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    min-height: 96px;
    padding: 16px 32px 20px;
    box-sizing: border-box;
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
  }

  .backButton {
    background-color: #000000;
    color: #ffffff;
    border: none;
    font-size: 1.6rem;
    padding: 0.6rem 2.6rem;
    min-width: 84px;
    min-height: 48px;
    border-radius: 0;
    box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    margin-right: 1.5rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .backIcon {
    width: 28px;
    height: 28px;
    fill: currentColor;
  }

  @media (max-width: 900px) {
    .backButton {
      font-size: 1.8rem;
      padding: 0.8rem 3rem;
      min-width: 96px;
      min-height: 56px;
    }

    .topbar {
      min-height: 110px;
      padding: 18px 20px 22px;
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
