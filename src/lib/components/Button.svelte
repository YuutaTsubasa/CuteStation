<script context="module" lang="ts">
  export type ButtonVariant =
    | "default"
    | "secondary"
    | "danger"
    | "outline"
    | "ghost"
    | "toggle";
</script>

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { assetManifest } from "$lib/game/assets/AssetManifest";
  import { audioManager } from "$lib/game/audio/AudioManager";

  export let label = "";
  export let variant: ButtonVariant = "default";
  export let disabled = false;
  export let className = "";
  export let type: "button" | "submit" | "reset" = "button";
  export let active = false;
  export let element: HTMLButtonElement | null = null;
  export let onClick: (() => void) | undefined = undefined;

  const dispatch = createEventDispatcher();

  let restProps: Record<string, unknown> = {};
  let restClass = "";

  $: {
    const { class: cls = "", ...rest } = $$restProps;
    restProps = rest;
    restClass = typeof cls === "string" ? cls : "";
  }

  const handleClick = (event: MouseEvent) => {
    if (disabled) {
      return;
    }
    audioManager.playSfx(assetManifest.audio.sfx.confirm);
    onClick?.();
    dispatch("click", event);
  };
</script>

<button
  bind:this={element}
  class={`baseButton ${variant} ${className} ${restClass}`.trim()}
  style={`background-image: url(${assetManifest.ui.backgroundWhiteButton});`}
  type={type}
  data-active={active}
  on:click={handleClick}
  disabled={disabled}
  {...restProps}
>
  <span><slot>{label}</slot></span>
</button>

<style>
  .baseButton {
    position: relative;
    padding: 0.2rem 2.5rem;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    font-family: inherit;
    background-size: cover;
    background-position: 50% 15%;
    overflow: hidden;
    z-index: 0;
  }

  .baseButton span {
    position: relative;
    z-index: 2;
  }

  .baseButton::before {
    content: "";
    position: absolute;
    inset: 0;
    background-color: var(--btn-color, white);
    mix-blend-mode: multiply;
    opacity: 1;
    z-index: 1;
  }

  .baseButton.default {
    --btn-color: #0000ff;
    color: white;
  }

  .baseButton.secondary {
    --btn-color: #e2e8f0;
    color: #1e293b;
  }

  .baseButton.danger {
    --btn-color: #ef4444;
    color: white;
  }

  .baseButton.outline {
    --btn-color: transparent;
    background-color: transparent;
    border: 2px solid #94a3b8;
    color: #1e293b;
  }

  .baseButton.ghost {
    --btn-color: transparent;
    background-color: transparent;
    color: #64748b;
  }

  .baseButton.toggle {
    --btn-color: #1f1f1f;
    color: #ffffff;
  }

  .baseButton.toggle[data-active="true"] {
    --btn-color: #3b7cff;
  }

  .baseButton:disabled {
    --btn-color: #cbd5e1;
    color: #64748b;
    cursor: not-allowed;
  }

  .baseButton:global(.navFocused),
  .baseButton:hover:not(:disabled),
  .baseButton:active:not(:disabled) {
    filter: invert(1) brightness(1.5);
  }
</style>
