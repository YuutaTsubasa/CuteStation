<script lang="ts">
  import { onMount } from "svelte";
  import { assetManifest } from "$lib/game/assets/AssetManifest";
  import { PopupResult, PopupStore, type PopupData } from "$lib/systems/PopupStore";
  import Button from "./Button.svelte";

  export let popup: PopupData;

  let rootElement: HTMLElement | null = null;
  let boxElement: HTMLElement | null = null;
  let backdropVisible = false;
  let boxVisible = false;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  onMount(async () => {
    backdropVisible = true;
    await sleep(20);
    boxVisible = true;
  });

  async function handleClose() {
    boxVisible = false;
    await sleep(300);
    backdropVisible = false;
    await sleep(200);
    PopupStore.close(popup.id);
  }

  async function handleClick(index: number) {
    const button = popup.buttons[index];
    if (button?.onClick) {
      const clickedResult = button.onClick();
      if (clickedResult === PopupResult.Keep) {
        return;
      }
    }

    await handleClose();
    popup.resolve(index);
  }
</script>

<div bind:this={rootElement} class="popupBackdrop" data-visible={backdropVisible}>
  <div
    class="popupBackground"
    data-visible={boxVisible}
    style={`background-image: url(${assetManifest.ui.backgroundWhite});`}
  >
    <div
      class="popupBox"
      bind:this={boxElement}
      data-visible={boxVisible}
    >
      <div class="popupTitle">{popup.title}</div>
      <div class="popupContent">
        {#if popup.autoClose}
          <div class="loadingContainer">
            <div class="loadingSpinner"></div>
            <div class="loadingText">{@html popup.content}</div>
          </div>
        {:else}
          {@html popup.content}
        {/if}
      </div>
      {#if !popup.autoClose && popup.buttons.length > 0}
        <div class="popupButtons">
          {#each popup.buttons as { text, variant }, i}
            <Button variant={variant ?? "default"} onClick={() => handleClick(i)}>
              {text}
            </Button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .popupBackdrop {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0);
    backdrop-filter: blur(0);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, background-color 0.2s ease, backdrop-filter 0.2s ease;
    z-index: 9999;
  }

  .popupBackdrop[data-visible="true"] {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    pointer-events: auto;
  }

  .popupBackground {
    width: 100%;
    max-width: 720px;
    margin: 0 16px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    display: flex;
    justify-content: center;
    align-items: center;
    background-size: cover;
    transform: scaleY(0);
    transform-origin: center center;
    transition: transform 0.3s ease;
  }

  .popupBackground[data-visible="true"] {
    transform: scaleY(1);
  }

  .popupBox {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 600px;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .popupBox[data-visible="true"] {
    opacity: 1;
  }

  .popupTitle {
    font-size: 1.5rem;
    font-weight: 700;
    text-align: center;
    padding: 1rem;
    font-family: "Noto Serif TC", "Noto Sans TC", sans-serif;
  }

  .popupContent {
    padding: 1rem 1.2rem;
    font-weight: 600;
    font-size: 1rem;
    line-height: 1.5;
    text-align: left;
  }

  .popupButtons {
    padding: 1rem;
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .loadingContainer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .loadingSpinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loadingText {
    text-align: center;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
