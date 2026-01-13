<script lang="ts">
  import { onMount } from "svelte";
  import { Assets } from "pixi.js";
  import { GamePlayPage } from "$lib/pages/GamePlayPage";
  import { LevelEditorPage } from "$lib/pages/LevelEditorPage";
  import { MainMenuPage } from "$lib/pages/MainMenuPage";
  import { PageManager } from "$lib/pages/PageManager";
  import { SettingsPage } from "$lib/pages/SettingsPage";
  import { SplashScreenPage } from "$lib/pages/SplashScreenPage";
  import Button from "$lib/components/Button.svelte";
  import PopupHost from "$lib/components/PopupHost.svelte";
  import TopBar from "$lib/components/TopBar.svelte";
  import VirtualControls from "$lib/components/VirtualControls.svelte";
  import { VirtualInput } from "$lib/game/input/VirtualInput";
  import { assetManifest } from "$lib/game/assets/AssetManifest";
  import { audioManager } from "$lib/game/audio/AudioManager";
  import type { LevelEnemy } from "$lib/game/levels/LevelLoader";
  import { LocalizationStore } from "$lib/systems/LocalizationStore";
  import { t } from "$lib/systems/LocalizationStore";
  import { onDestroy } from "svelte";

  let status = $state("Initializing...");
  let currentPageId = $state("None");
  let pixiRoot: HTMLDivElement | null = null;
  let pageManager: PageManager | null = null;
  let gameplay: GamePlayPage | null = null;
  let pixiFrame: HTMLDivElement | null = null;
  let coinCount = $state(0);
  let coinTotal = $state(0);
  let playerHp = $state(3);
  let playerHpMax = $state(3);
  let levelTime = $state(0);
  let levelName = $state("WHITE PALACE ZONE 1");
  let levelClear = $state(false);
  let levelClearTimeout: number | null = null;
  let editor: LevelEditorPage | null = null;
  let settings: SettingsPage | null = null;
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
  let gameplayHudVisible = $state(false);
  let gameplayTopbarVisible = $state(false);
  let introOverlayOpacity = $state(0);
  let introLogoOpacity = $state(0);
  let introActive = $state(false);
  let introToken = 0;
  let pageFadeOpacity = $state(0);
  let pageFadeActive = $state(false);
  let pageTransitioning = false;
  let editorUiActive = $state(false);
  let editorUiIndex = $state(0);
  let editorUiSelected = $state<HTMLElement | null>(null);
  let editorGamepadRaf = 0;
  let editorLastDpad = { up: false, down: false, left: false, right: false };
  let editorLastConfirm = false;
  const editorGamepadDeadzone = 0.3;
  let editorButtonAddSolid = $state<HTMLButtonElement | null>(null);
  let editorButtonAddCoin = $state<HTMLButtonElement | null>(null);
  let editorButtonAddEnemy = $state<HTMLButtonElement | null>(null);
  let editorButtonDelete = $state<HTMLButtonElement | null>(null);
  let editorButtonGrid = $state<HTMLButtonElement | null>(null);
  let editorButtonSnap = $state<HTMLButtonElement | null>(null);
  let editorButtonWidthPlus = $state<HTMLButtonElement | null>(null);
  let editorButtonWidthMinus = $state<HTMLButtonElement | null>(null);
  let editorButtonHeightPlus = $state<HTMLButtonElement | null>(null);
  let editorButtonHeightMinus = $state<HTMLButtonElement | null>(null);
  let editorButtonPlayTest = $state<HTMLButtonElement | null>(null);
  let editorButtonExport = $state<HTMLButtonElement | null>(null);
  let editorButtonBack = $state<HTMLButtonElement | null>(null);
  let editorEnemyTypeSelect = $state<HTMLSelectElement | null>(null);
  let editorEnemyPatrolRangeInput = $state<HTMLInputElement | null>(null);
  let editorEnemyPatrolSpeedInput = $state<HTMLInputElement | null>(null);
  let editorEnemyIdleDurationInput = $state<HTMLInputElement | null>(null);
  let editorEnemyGravityInput = $state<HTMLInputElement | null>(null);

  let uiScale = $state(1);
  let uiOffsetX = $state(0);
  let uiOffsetY = $state(0);
  let uiTransform = $state("");
  const frameWidth = 1920;
  const frameHeight = 1080;

  let musicVolume = $state(100);
  let sfxVolume = $state(100);
  let selectedLocale = $state(LocalizationStore.getLocale());
  let localeUnsubscribe: (() => void) | null = null;

  const availableLocales = LocalizationStore.availableLocales;

  const localeLabelMap: Record<string, string> = {
    "zh-tw": "繁體中文",
    en: "English",
    ja: "日本語",
    ko: "한국어",
  };

  const getLocaleLabel = (locale: string) =>
    localeLabelMap[locale] ?? locale.toUpperCase();

  const syncVolumesFromAudio = () => {
    musicVolume = Math.round(audioManager.getBgmVolume() * 100);
    sfxVolume = Math.round(audioManager.getSfxVolume() * 100);
  };

  const setMusicVolume = (value: number) => {
    const normalized = Math.max(0, Math.min(100, value));
    musicVolume = normalized;
    const volume = normalized / 100;
    audioManager.setBgmVolume(volume);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("cutestation.bgmVolume", volume.toString());
    }
  };

  const setSfxVolume = (value: number) => {
    const normalized = Math.max(0, Math.min(100, value));
    sfxVolume = normalized;
    const volume = normalized / 100;
    audioManager.setSfxVolume(volume);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("cutestation.sfxVolume", volume.toString());
    }
  };

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
    levelTime = 0;
    playerHp = 3;
    playerHpMax = 3;
    levelName = "WHITE PALACE ZONE 1";
    gameLoading = true;
    gameplayHudVisible = false;
    gameplayTopbarVisible = false;
    introOverlayOpacity = 0;
    introLogoOpacity = 0;
    introActive = false;
    showVirtualControls = false;
    if (levelClearTimeout) {
      window.clearTimeout(levelClearTimeout);
      levelClearTimeout = null;
    }
  }

  async function goTo(id: string) {
    if (pageTransitioning) {
      return;
    }
    if (id === "GamePlay") {
      resetGameplayHud();
    }
    introToken += 1;
    pageTransitioning = true;
    pageFadeActive = true;
    pageFadeOpacity = 1;
    await sleep(220);
    if (id === "LevelEditor") {
      gridEnabled = true;
      snapEnabled = true;
    }
    pageManager?.goTo(id);
    updateStatus();
    updateUiLayout();
    window.requestAnimationFrame(() => updateUiLayout());
    await sleep(80);
    pageFadeOpacity = 0;
    await sleep(220);
    pageFadeActive = false;
    pageTransitioning = false;
  }

  const sleep = (ms: number) =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const startGameplayIntro = async () => {
    if (!gameplay) {
      return;
    }
    const token = ++introToken;
    introActive = true;
    introOverlayOpacity = 0.6;
    introLogoOpacity = 0;
    gameplayHudVisible = false;
    gameplayTopbarVisible = false;
    gameplay.setInputEnabled(false);
    await sleep(120);
    if (token !== introToken) {
      return;
    }
    introLogoOpacity = 1;
    await sleep(1000);
    if (token !== introToken) {
      return;
    }
    introLogoOpacity = 0;
    await sleep(400);
    if (token !== introToken) {
      return;
    }
    introOverlayOpacity = 0;
    await sleep(360);
    if (token !== introToken) {
      return;
    }
    introActive = false;
    gameplayHudVisible = true;
    await sleep(60);
    if (token !== introToken) {
      return;
    }
    gameplayTopbarVisible = true;
    await sleep(300);
    if (token !== introToken) {
      return;
    }
    gameplay.setInputEnabled(true);
  };

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
    void LocalizationStore.initialize();
    const storedBgm = typeof localStorage !== "undefined"
      ? Number(localStorage.getItem("cutestation.bgmVolume"))
      : NaN;
    if (!Number.isNaN(storedBgm)) {
      audioManager.setBgmVolume(storedBgm);
    }
    const storedSfx = typeof localStorage !== "undefined"
      ? Number(localStorage.getItem("cutestation.sfxVolume"))
      : NaN;
    if (!Number.isNaN(storedSfx)) {
      audioManager.setSfxVolume(storedSfx);
    }
    syncVolumesFromAudio();
    localeUnsubscribe = LocalizationStore.locale.subscribe((value) => {
      selectedLocale = value;
    });
    if (/SamsungBrowser/i.test(navigator.userAgent)) {
      Assets.setPreferences({ preferCreateImageBitmap: false });
    }

    const preventTouchRefresh = (event: TouchEvent) => {
      if (currentPageId !== "GamePlay") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("touchstart", preventTouchRefresh, { passive: false });
    window.addEventListener("touchmove", preventTouchRefresh, { passive: false });

    const manager = new PageManager();
    const splash = new SplashScreenPage();
    const menu = new MainMenuPage();
    gameplay = new GamePlayPage();
    const levelEditor = new LevelEditorPage();
    const settingsPage = new SettingsPage();

    splash.setHost(pixiFrame);
    splash.setOnComplete(() => goTo("MainMenu"));
    menu.setHost(pixiFrame);
    menu.setOnNavigate((id) => goTo(id));
    gameplay.setHost(pixiFrame);
    gameplay.setOnRequestExit(() => {
      introToken += 1;
      goTo("MainMenu");
    });
    gameplay.setOnRequestPlaytestExit(() => {
      introToken += 1;
      goTo("LevelEditor");
    });
    gameplay.setOnCoinChange((count, total) => {
      coinCount = count;
      coinTotal = total;
    });
    gameplay.setOnHealthChange((current, max) => {
      playerHp = current;
      playerHpMax = max;
    });
    gameplay.setOnTimeChange((seconds) => {
      levelTime = seconds;
    });
    gameplay.setOnLevelName((name) => {
      levelName = name;
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
      void startGameplayIntro();
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
    settings = settingsPage;

    manager.register(splash);
    manager.register(menu);
    manager.register(gameplay);
    manager.register(levelEditor);
    manager.register(settingsPage);

    pageManager = manager;
    goTo("SplashScreen");
    updateUiLayout();
    const resizeHandler = () => updateUiLayout();
    window.addEventListener("resize", resizeHandler);

    document.body.style.backgroundImage = `url("${gameBackgroundUrl}")`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";

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

    const updateEditorGamepad = () => {
      const inEditor = currentPageId === "LevelEditor";
      if (!inEditor) {
        if (editorUiActive) {
          editorUiActive = false;
          editorUiSelected = null;
        }
        editor?.setGamepadUiMode(false);
        editorGamepadRaf = window.requestAnimationFrame(updateEditorGamepad);
        return;
      }

      const pads = navigator.getGamepads?.() ?? [];
      const pad = Array.from(pads).find((entry) => entry && entry.connected) ?? null;
      if (!pad) {
        if (editorUiActive) {
          editorUiActive = false;
          editorUiSelected = null;
        }
        editor?.setGamepadUiMode(false);
        editorGamepadRaf = window.requestAnimationFrame(updateEditorGamepad);
        return;
      }

      const leftStickActive =
        Math.abs(pad.axes[0] ?? 0) >= editorGamepadDeadzone ||
        Math.abs(pad.axes[1] ?? 0) >= editorGamepadDeadzone;
      const dpad = {
        up: Boolean(pad.buttons[12]?.pressed),
        down: Boolean(pad.buttons[13]?.pressed),
        left: Boolean(pad.buttons[14]?.pressed),
        right: Boolean(pad.buttons[15]?.pressed),
      };
      const anyDpad = dpad.up || dpad.down || dpad.left || dpad.right;

      if (leftStickActive) {
        if (editorUiActive) {
          editorUiActive = false;
          editorUiSelected = null;
        }
        editor?.setGamepadUiMode(false);
      } else if (anyDpad) {
        if (!editorUiActive) {
          editorUiActive = true;
          editorUiIndex = 0;
        }
        editor?.setGamepadUiMode(true);
      }

      if (editorUiActive) {
        const elements = getEditorUiElements();
        syncEditorUiSelection(elements);

        let delta = 0;
        if (dpad.up && !editorLastDpad.up) {
          delta = -1;
        } else if (dpad.down && !editorLastDpad.down) {
          delta = 1;
        } else if (dpad.left && !editorLastDpad.left) {
          delta = -1;
        } else if (dpad.right && !editorLastDpad.right) {
          delta = 1;
        }

        if (delta !== 0) {
          moveEditorUiSelection(delta);
        }

        const confirmPressed = Boolean(pad.buttons[0]?.pressed);
        if (confirmPressed && !editorLastConfirm) {
          activateEditorUiSelection();
        }
        editorLastConfirm = confirmPressed;
      } else {
        editorLastConfirm = Boolean(pad.buttons[0]?.pressed);
      }

      editorLastDpad = dpad;
      editorGamepadRaf = window.requestAnimationFrame(updateEditorGamepad);
    };

    editorGamepadRaf = window.requestAnimationFrame(updateEditorGamepad);

    return () => {
      window.removeEventListener("touchstart", preventTouchRefresh);
      window.removeEventListener("touchmove", preventTouchRefresh);
      window.removeEventListener("resize", resizeHandler);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.cancelAnimationFrame(editorGamepadRaf);
      document.body.style.backgroundImage = "";
      document.body.style.backgroundSize = "";
      document.body.style.backgroundPosition = "";
      document.body.style.backgroundRepeat = "";
      resetGameplayHud();
      gameplay?.setVirtualInput(null);
      gameplay?.onExit();
      introToken += 1;
      levelEditor.onExit();
    };
  });

  onDestroy(() => {
    if (localeUnsubscribe) {
      localeUnsubscribe();
      localeUnsubscribe = null;
    }
  });

  const formatTime = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const secs = (total % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const hpPercent = () => {
    if (playerHpMax <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, (playerHp / playerHpMax) * 100));
  };

  const getEditorUiElements = () => {
    const elements: HTMLElement[] = [];
    if (editorButtonAddSolid) elements.push(editorButtonAddSolid);
    if (editorButtonAddCoin) elements.push(editorButtonAddCoin);
    if (editorButtonAddEnemy) elements.push(editorButtonAddEnemy);
    if (editorButtonDelete) elements.push(editorButtonDelete);
    if (editorButtonGrid) elements.push(editorButtonGrid);
    if (editorButtonSnap) elements.push(editorButtonSnap);
    if (editorButtonWidthPlus) elements.push(editorButtonWidthPlus);
    if (editorButtonWidthMinus) elements.push(editorButtonWidthMinus);
    if (editorButtonHeightPlus) elements.push(editorButtonHeightPlus);
    if (editorButtonHeightMinus) elements.push(editorButtonHeightMinus);
    if (editorButtonPlayTest) elements.push(editorButtonPlayTest);
    if (editorButtonExport) elements.push(editorButtonExport);
    if (editorButtonBack) elements.push(editorButtonBack);
    if (selectedEnemy) {
      if (editorEnemyTypeSelect) elements.push(editorEnemyTypeSelect);
      if (editorEnemyPatrolRangeInput) elements.push(editorEnemyPatrolRangeInput);
      if (editorEnemyPatrolSpeedInput) elements.push(editorEnemyPatrolSpeedInput);
      if (editorEnemyIdleDurationInput) elements.push(editorEnemyIdleDurationInput);
      if (editorEnemyGravityInput) elements.push(editorEnemyGravityInput);
    }
    return elements;
  };

  const syncEditorUiSelection = (elements: HTMLElement[]) => {
    if (elements.length === 0) {
      editorUiSelected = null;
      editorUiIndex = 0;
      return;
    }
    if (editorUiIndex >= elements.length) {
      editorUiIndex = elements.length - 1;
    }
    if (!editorUiSelected || !elements.includes(editorUiSelected)) {
      editorUiSelected = elements[editorUiIndex] ?? elements[0];
    }
    editorUiSelected?.focus({ preventScroll: true });
  };

  const moveEditorUiSelection = (delta: number) => {
    const elements = getEditorUiElements();
    if (elements.length === 0) {
      return;
    }
    const nextIndex = (editorUiIndex + delta + elements.length) % elements.length;
    editorUiIndex = nextIndex;
    editorUiSelected = elements[nextIndex];
    editorUiSelected?.focus({ preventScroll: true });
  };

  const activateEditorUiSelection = () => {
    if (!editorUiSelected) {
      return;
    }
    if (editorUiSelected instanceof HTMLButtonElement) {
      editorUiSelected.click();
      return;
    }
    if (editorUiSelected instanceof HTMLInputElement) {
      if (editorUiSelected.type === "checkbox") {
        editorUiSelected.click();
        return;
      }
    }
    editorUiSelected.focus({ preventScroll: true });
  };

</script>

<main class="container">
  <div class="stage" bind:this={pixiRoot}>
    <div class="stage-frame" bind:this={pixiFrame} style={`transform: ${uiTransform};`}>
      <div
        class="frame-fade"
        style={`opacity: ${pageFadeOpacity}; display: ${pageFadeActive ? "block" : "none"};`}
      ></div>
    </div>
    <div class="stage-ui" style={`transform: ${uiTransform};`}>
      {#if currentPageId === "GamePlay"}
        <div class="gameplay-topbar" class:gameplay-topbar-visible={gameplayTopbarVisible}>
          <div class="gameplay-topbar-title">{levelName}</div>
          <div class="gameplay-topbar-stats">
            <div class="stat-block">
              <div class="stat-label">HP</div>
              <div class="stat-value">{playerHp}/{playerHpMax}</div>
              <div class="hp-bar">
                <div class="hp-bar-fill" style={`width: ${hpPercent()}%;`}></div>
              </div>
            </div>
            <div class="stat-block">
              <div class="stat-label">TIME</div>
              <div class="stat-value">{formatTime(levelTime)}</div>
            </div>
            <div class="stat-block">
              <div class="stat-label">COINS</div>
              <div class="stat-value">{coinCount}/{coinTotal}</div>
            </div>
          </div>
        </div>
        <div class="gameplay-bottombar" class:gameplay-bottombar-visible={gameplayHudVisible}>
          <div class="gameplay-controls">
            <span class="controls-label">操作按鍵：</span>
            <span class="control-item">
              <span class="pad-icon">LS</span> 移動
            </span>
            <span class="control-item">
              <span class="pad-icon">X</span> 攻擊
            </span>
            <span class="control-item">
              <span class="pad-icon">A</span> 跳躍
            </span>
            <span class="control-divider">|</span>
            <span class="control-item">
              <span class="key-icon">A/D</span> 移動
            </span>
            <span class="control-item">
              <span class="key-icon">J/K</span> 攻擊
            </span>
            <span class="control-item">
              <span class="key-icon">Space</span> 跳躍
            </span>
          </div>
        </div>
        <div class="gameplay-intro" style={`display: ${introActive ? "flex" : "none"};`}>
          <div
            class="gameplay-intro-overlay"
            style={`opacity: ${introOverlayOpacity};`}
          ></div>
          <img
            class="gameplay-intro-logo"
            src={assetManifest.levels.whitePalace.visuals.logos.zone1}
            alt="White Palace Zone 1"
            style={`opacity: ${introLogoOpacity};`}
          />
        </div>
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
          <Button
            className={`editor-action ${editorUiSelected === editorButtonAddSolid ? "editor-ui-selected" : ""}`}
            bind:element={editorButtonAddSolid}
            on:click={() => editor?.addSolid()}
            >{$t("EDITOR_ADD_SOLID")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonAddCoin ? "editor-ui-selected" : ""}`}
            bind:element={editorButtonAddCoin}
            on:click={() => editor?.addCoin()}
            >{$t("EDITOR_ADD_COIN")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonAddEnemy ? "editor-ui-selected" : ""}`}
            bind:element={editorButtonAddEnemy}
            on:click={() => editor?.addEnemy()}
            >{$t("EDITOR_ADD_ENEMY")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonDelete ? "editor-ui-selected" : ""}`}
            bind:element={editorButtonDelete}
            on:click={() => editor?.deleteSelected()}
            >{$t("EDITOR_DELETE")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonGrid ? "editor-ui-selected" : ""}`}
            variant="toggle"
            active={gridEnabled}
            bind:element={editorButtonGrid}
            on:click={toggleGrid}
            >{$t("EDITOR_GRID")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonSnap ? "editor-ui-selected" : ""}`}
            variant="toggle"
            active={snapEnabled}
            bind:element={editorButtonSnap}
            on:click={toggleSnap}
            >{$t("EDITOR_SNAP")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonWidthPlus ? "editor-ui-selected" : ""}`}
            bind:element={editorButtonWidthPlus}
            on:click={() => editor?.resizeWorld(200, 0)}
            >{$t("EDITOR_WIDTH_PLUS")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonWidthMinus ? "editor-ui-selected" : ""}`}
            bind:element={editorButtonWidthMinus}
            on:click={() => editor?.resizeWorld(-200, 0)}
            >{$t("EDITOR_WIDTH_MINUS")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonHeightPlus ? "editor-ui-selected" : ""}`}
            bind:element={editorButtonHeightPlus}
            on:click={() => editor?.resizeWorld(0, 200)}
            >{$t("EDITOR_HEIGHT_PLUS")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonHeightMinus ? "editor-ui-selected" : ""}`}
            bind:element={editorButtonHeightMinus}
            on:click={() => editor?.resizeWorld(0, -200)}
            >{$t("EDITOR_HEIGHT_MINUS")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonPlayTest ? "editor-ui-selected" : ""}`}
            bind:element={editorButtonPlayTest}
            on:click={() => editor?.playTest()}
            >{$t("EDITOR_PLAY_TEST")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonExport ? "editor-ui-selected" : ""}`}
            bind:element={editorButtonExport}
            on:click={exportLevel}
            >{$t("EDITOR_EXPORT")}</Button
          >
          <Button
            className={`editor-action ${editorUiSelected === editorButtonBack ? "editor-ui-selected" : ""}`}
            bind:element={editorButtonBack}
            on:click={() => goTo("MainMenu")}
            >{$t("EDITOR_BACK")}</Button
          >
        </div>
        {#if selectedEnemy}
          <div class="editor-panel">
            <div class="panel-title">Enemy Settings</div>
            <label class="panel-row">
              <span>Type</span>
              <select
                value={enemyType}
                bind:this={editorEnemyTypeSelect}
                class:editor-ui-selected={editorUiSelected === editorEnemyTypeSelect}
                onchange={(event) => {
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
                bind:this={editorEnemyPatrolRangeInput}
                class:editor-ui-selected={editorUiSelected === editorEnemyPatrolRangeInput}
                min="0"
                step="1"
                disabled={enemyType !== "patrol"}
                onchange={(event) => {
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
                bind:this={editorEnemyPatrolSpeedInput}
                class:editor-ui-selected={editorUiSelected === editorEnemyPatrolSpeedInput}
                min="0"
                step="1"
                disabled={enemyType !== "patrol"}
                onchange={(event) => {
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
                bind:this={editorEnemyIdleDurationInput}
                class:editor-ui-selected={editorUiSelected === editorEnemyIdleDurationInput}
                min="0"
                step="0.1"
                onchange={(event) => {
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
                bind:this={editorEnemyGravityInput}
                class:editor-ui-selected={editorUiSelected === editorEnemyGravityInput}
                onchange={(event) => {
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
      {:else if currentPageId === "Settings"}
        <div class="settings-page">
          <TopBar
            primaryTitle={$t("SETTINGS_TITLE")}
            secondaryTitle={selectedLocale.startsWith("en") ? "" : "Settings"}
            onBack={() => goTo("MainMenu")}
          />
          <div class="settings-panel">
            <div class="settings-row">
              <div class="settings-label">{$t("SETTINGS_MUSIC_VOLUME")}</div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={musicVolume}
                oninput={(event) =>
                  setMusicVolume(Number((event.target as HTMLInputElement).value))}
              />
              <div class="settings-value">{musicVolume}%</div>
            </div>
            <div class="settings-row">
              <div class="settings-label">{$t("SETTINGS_SFX_VOLUME")}</div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={sfxVolume}
                oninput={(event) =>
                  setSfxVolume(Number((event.target as HTMLInputElement).value))}
              />
              <div class="settings-value">{sfxVolume}%</div>
            </div>
            <div class="settings-row">
              <div class="settings-label">{$t("SETTINGS_LANGUAGE")}</div>
              <select
                value={selectedLocale}
                onchange={(event) => {
                  const value = (event.target as HTMLSelectElement).value;
                  selectedLocale = value;
                  LocalizationStore.setLocale(value);
                }}
              >
                {#each $availableLocales as locale}
                  <option value={locale}>{getLocaleLabel(locale)}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>
      {:else}
        <!-- Main menu UI is rendered by MainMenuPage in Pixi. -->
      {/if}
    </div>
    {#if currentPageId === "GamePlay" && showVirtualControls}
      <VirtualControls input={virtualInput} />
    {/if}
  </div>
  <PopupHost />
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

@font-face {
  font-family: "Noto Serif TC";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/ProjectContent/Fonts/NotoSerifTC-Regular.ttf") format("truetype");
}

@font-face {
  font-family: "Noto Serif TC";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("/ProjectContent/Fonts/NotoSerifTC-Bold.ttf") format("truetype");
}

:global(body),
:global(button),
:global(input),
:global(textarea),
:global(select) {
  font-family: "Gabarito", "Noto Sans TC", sans-serif;
}

:global(input),
:global(textarea),
:global(select) {
  -webkit-user-select: text;
  user-select: text;
  touch-action: manipulation;
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

:global(html),
:global(body) {
  margin: 0;
  width: 100%;
  height: 100%;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  overflow: hidden;
  overscroll-behavior: none;
  overscroll-behavior-y: none;
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
  background: transparent;
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
  overflow: hidden;
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

.gameplay-topbar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 72px;
  display: flex;
  z-index: 2;
  pointer-events: none;
  transform: translateY(-100%);
  transition: transform 0.35s ease;
}

.gameplay-topbar.gameplay-topbar-visible {
  transform: translateY(0);
}

.gameplay-topbar-title {
  width: 33.33%;
  background: #ffffff;
  color: #000000;
  display: flex;
  align-items: center;
  padding: 0 24px;
  font-weight: 700;
  font-size: 28px;
  letter-spacing: 1px;
  text-transform: uppercase;
  box-sizing: border-box;
}

.gameplay-topbar-stats {
  width: 66.67%;
  background: #0b0b0b;
  color: #ffffff;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  box-sizing: border-box;
}

.stat-block {
  display: grid;
  gap: 6px;
}

.stat-label {
  font-size: 14px;
  letter-spacing: 2px;
  opacity: 0.75;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
}

.hp-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  overflow: hidden;
}

.hp-bar-fill {
  height: 100%;
  background: #ffffff;
  transition: width 0.15s linear;
}

.gameplay-bottombar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: flex-end;
  background: #0b0b0b;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.gameplay-bottombar.gameplay-bottombar-visible {
  opacity: 1;
}

.gameplay-controls {
  color: #ffffff;
  padding: 12px 28px;
  font-size: 18px;
  letter-spacing: 1px;
  text-align: right;
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  justify-content: flex-end;
  box-sizing: border-box;
}

.controls-label {
  opacity: 0.8;
}

.control-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.control-divider {
  opacity: 0.35;
}

.pad-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 2px solid #ffffff;
  font-weight: 700;
  font-size: 14px;
}

.key-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 28px;
  padding: 0 8px;
  border-radius: 8px;
  border: 2px solid #ffffff;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.gameplay-intro {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 4;
}

.gameplay-intro-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.gameplay-intro-logo {
  width: min(960px, 50%);
  height: auto;
  transition: opacity 0.35s ease;
  position: relative;
  z-index: 1;
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

.settings-page {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.settings-panel {
  margin: 120px auto 0;
  width: 80%;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 24px 32px;
  display: grid;
  gap: 18px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.settings-row {
  display: grid;
  grid-template-columns: 15% 70% 15%;
  align-items: center;
  gap: 16px;
}

.settings-label {
  font-weight: 600;
  font-size: 22px;
  color: #1f2937;
}

.settings-value {
  text-align: left;
  color: #4b5563;
  font-variant-numeric: tabular-nums;
  font-size: 20px;
  padding-left: 8px;
}

.settings-row input[type="range"] {
  width: 100%;
}

.settings-row select {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 20px;
}

@media (max-width: 900px) {
  .settings-panel {
    margin: 96px auto 0;
    width: 92%;
    padding: 28px 24px;
    gap: 20px;
  }

  .settings-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .settings-label {
    font-size: 26px;
  }

  .settings-value {
    font-size: 22px;
    text-align: right;
    padding-left: 0;
  }

  .settings-row input[type="range"] {
    height: 32px;
  }

  .settings-row select {
    font-size: 22px;
    padding: 12px;
  }
}

.stage-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.frame-fade {
  position: absolute;
  inset: 0;
  background: #000000;
  opacity: 0;
  transition: opacity 0.22s ease;
  z-index: 4;
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

:global(.editor-action) {
  padding: 10px 18px;
  border-radius: 0;
  border: 1px solid #2b2b2b;
  font-weight: 500;
  font-size: 22px;
  pointer-events: auto;
  background-image: none !important;
  color: #f5f5f5;
  --btn-color: #1f1f1f;
}

:global(.editor-action)::before {
  background-color: #1f1f1f;
  mix-blend-mode: normal;
  opacity: 1;
}

:global(.editor-action:hover),
:global(.editor-action:active) {
  filter: none;
  background-color: #2b2b2b;
  border-color: #3a3a3a;
}

:global(.editor-action.toggle[data-active="true"]) {
  --btn-color: #3b7cff;
  border-color: #3b7cff;
}

:global(.editor-ui-selected) {
  outline: 2px solid #3b7cff;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px rgba(59, 124, 255, 0.35);
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
