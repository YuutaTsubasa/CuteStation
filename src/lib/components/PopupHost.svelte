<script lang="ts">
  import { onDestroy } from "svelte";
  import { PopupStore, type PopupData } from "$lib/systems/PopupStore";
  import PopupItem from "./PopupItem.svelte";

  let popups: PopupData[] = [];
  const unsubscribe = PopupStore.subscribe((value) => {
    popups = value;
  });

  onDestroy(() => unsubscribe());
</script>

{#each popups as popup (popup.id)}
  <PopupItem {popup} />
{/each}
