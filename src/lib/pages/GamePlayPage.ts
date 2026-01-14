import { Application, Container, Graphics, Sprite } from "pixi.js";
import { loadLevel, type LevelEnemy } from "../game/levels/LevelLoader";
import { LevelRuntime } from "../game/levels/LevelRuntime";
import { LevelVisuals } from "../game/visuals/LevelVisuals";
import { normalizeVisualsConfig, type VisualsConfig } from "../game/visuals/VisualsConfig";
import { Player } from "../game/entities/Player";
import { Enemy } from "../game/entities/Enemy";
import { Collectible } from "../game/entities/Collectible";
import { Combat, type CombatHit } from "../game/systems/Combat";
import { audioManager } from "../game/audio/AudioManager";
import { whitePalaceBgmPath } from "../game/audio/audioPaths";
import { Physics, type Rect } from "../game/systems/Physics";
import { Input } from "../game/core/Input";
import { type VirtualInputState, VirtualInput } from "../game/input/VirtualInput";
import { GAME_HEIGHT, GAME_WIDTH } from "../game/view/ResolutionManager";
import { LevelSession } from "../game/levels/LevelSession";
import { assetManifest } from "../game/assets/AssetManifest";
import { Page } from "./Page";

type SlashProjectile = {
  graphic: Graphics;
  x: number;
  y: number;
  vx: number;
  width: number;
  height: number;
  ttl: number;
  hitTargets: Set<Enemy>;
};

type HomingTrail = {
  sprites: Sprite[];
  baseAlphas: number[];
  start: { x: number; y: number };
  end: { x: number; y: number };
  pickupStart: { x: number; y: number };
  pickupEnd: { x: number; y: number };
  halfThickness: number;
  pickupHalfThickness: number;
  ttl: number;
  duration: number;
};

export class GamePlayPage extends Page {
  private readonly worldScale = 3;
  private readonly baseFloorY = 400;
  private readonly worldPadding = { top: 320, right: 0, bottom: 0, left: 0 };
  private readonly visualsConfigPath =
    assetManifest.levels.whitePalace.visuals.config;
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private gameRoot: Container | null = null;
  private player: Player | null = null;
  private background: Container | null = null;
  private world: Container | null = null;
  private effectsLayer: Container | null = null;
  private runtime: LevelRuntime | null = null;
  private visuals: LevelVisuals | null = null;
  private platforms: Rect[] = [];
  private combat = new Combat();
  private enemies: Enemy[] = [];
  private hitEffects: Array<{ graphic: Graphics; ttl: number; duration: number }> =
    [];
  private hitStopTimer = 0;
  private homingRadius = 180;
  private homingTarget: Enemy | null = null;
  private homingAttackTarget: Enemy | null = null;
  private homingReticle: Graphics | null = null;
  private slashProjectiles: SlashProjectile[] = [];
  private lastSlashAttackId = -1;
  private homingTrails: HomingTrail[] = [];
  private readonly homingTrailDuration = 1.5;
  private worldBounds: { minX: number; minY: number; maxX: number; maxY: number } | null =
    null;
  private readonly enemyContactKnockbackSpeed = 420;
  private readonly enemyContactKnockbackOffset = 12;
  private collectibles: Collectible | null = null;
  private levelCleared = false;
  private enemyContactTimer = 0;
  private homingHoldLatch = false;
  private tickerHandler: (() => void) | null = null;
  private onRequestExit: (() => void) | null = null;
  private onCoinChange: ((count: number, total: number) => void) | null = null;
  private onLevelClear: (() => void) | null = null;
  private onHealthChange: ((current: number, max: number) => void) | null = null;
  private onTimeChange: ((seconds: number) => void) | null = null;
  private onLevelName: ((name: string) => void) | null = null;
  private onReady: (() => void) | null = null;
  private onRequestPlaytestExit: (() => void) | null = null;
  private isPlaytest = false;
  private elapsedSeconds = 0;
  private inputEnabled = true;
  private deathState: "none" | "waiting" | "fading" = "none";
  private deathOverlay: Graphics | null = null;
  private deathFadeTimer = 0;
  private readonly deathFadeDuration = 0.6;
  private isRestarting = false;
  private inputState = {
    move: 0,
    jump: false,
    attack: false,
  };
  private keyboardInput: VirtualInputState = {
    moveX: 0,
    jumpDown: false,
    jumpHeld: false,
    attackDown: false,
    attackHeld: false,
  };
  private virtualInput: VirtualInput | null = null;
  private inputHelper = new Input();
  private keyDownHandler: ((event: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((event: KeyboardEvent) => void) | null = null;
  private enterToken = 0;
  private audioContext: AudioContext | null = null;
  private lastHitSoundAt = 0;

  constructor() {
    super("GamePlay");
  }

  setHost(host: HTMLElement | null) {
    this.host = host;
  }

  setOnRequestExit(handler: (() => void) | null) {
    this.onRequestExit = handler;
  }

  setOnCoinChange(handler: ((count: number, total: number) => void) | null) {
    this.onCoinChange = handler;
  }

  setOnLevelClear(handler: (() => void) | null) {
    this.onLevelClear = handler;
  }

  setOnHealthChange(handler: ((current: number, max: number) => void) | null) {
    this.onHealthChange = handler;
  }

  setOnTimeChange(handler: ((seconds: number) => void) | null) {
    this.onTimeChange = handler;
  }

  setOnLevelName(handler: ((name: string) => void) | null) {
    this.onLevelName = handler;
  }

  setInputEnabled(enabled: boolean) {
    this.inputEnabled = enabled;
  }

  setOnRequestPlaytestExit(handler: (() => void) | null) {
    this.onRequestPlaytestExit = handler;
  }

  setOnReady(handler: (() => void) | null) {
    this.onReady = handler;
  }

  setVirtualInput(input: VirtualInput | null) {
    this.virtualInput = input;
  }

  override async onEnter() {
    super.onEnter();

    if (!this.host || this.app) {
      return;
    }
    this.keyboardInput = {
      moveX: 0,
      jumpDown: false,
      jumpHeld: false,
      attackDown: false,
      attackHeld: false,
    };
    this.inputState = { move: 0, jump: false, attack: false };
    this.slashProjectiles = [];
    this.lastSlashAttackId = -1;
    this.homingTrails = [];
    this.deathState = "none";
    this.deathFadeTimer = 0;

    this.enterToken += 1;
    const token = this.enterToken;

    const app = new Application();
    await app.init({ background: "#0b0b0b", width: GAME_WIDTH, height: GAME_HEIGHT });
    if (token !== this.enterToken) {
      app.destroy(true);
      return;
    }
    this.host.appendChild(app.canvas);

    if (!this.isActive) {
      app.destroy(true);
      app.canvas.remove();
      return;
    }

    const abort = () => {
      app.destroy(true);
      app.canvas.remove();
      this.gameRoot = null;
    };

    const gameRoot = new Container();
    app.stage.addChild(gameRoot);
    gameRoot.visible = false;

    this.gameRoot = gameRoot;

    const deathOverlay = new Graphics();
    deathOverlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(0x000000);
    deathOverlay.alpha = 0;
    app.stage.addChild(deathOverlay);
    this.deathOverlay = deathOverlay;

    const previewLevel = LevelSession.getPreviewLevel();
    this.isPlaytest = Boolean(previewLevel);
    const level =
      previewLevel ??
      (await loadLevel(assetManifest.levels.whitePalace.level1));
    if (token !== this.enterToken) {
      abort();
      return;
    }
    this.onLevelName?.(assetManifest.levels.whitePalace.displayName ?? level.name);

    const world = new Container();
    const background = new Container();
    gameRoot.addChild(background);
    gameRoot.addChild(world);
    this.background = background;
    this.world = world;
    const effectsLayer = new Container();
    this.effectsLayer = effectsLayer;
    const homingReticle = new Graphics();
    homingReticle.visible = false;
    effectsLayer.addChild(homingReticle);
    this.homingReticle = homingReticle;

    const runtime = new LevelRuntime(level, {
      worldScale: this.worldScale,
      baseFloorY: this.baseFloorY,
      worldPadding: this.worldPadding,
      showSolids: false,
      showCoins: true,
      showGoal: true,
      showSpawn: false,
    });
    runtime.attach(world);
    await runtime.loadCoinAssets();
    this.runtime = runtime;
    this.platforms = runtime.getSolidsWorld();
    this.worldBounds = runtime.getWorldBounds();

    const visualsConfig = await this.loadVisualsConfig();
    const visuals = new LevelVisuals(level, runtime, {
      worldScale: this.worldScale,
      backgroundPaths: assetManifest.levels.whitePalace.visuals.background,
      platformTilePath: assetManifest.levels.whitePalace.visuals.terrain.platformTile,
      config: visualsConfig,
    });
    await visuals.load(GAME_WIDTH, GAME_HEIGHT);
    visuals.attach(background, world);
    this.visuals = visuals;

    const spawnOffsetY = runtime.worldOffsetY / this.worldScale;
    const player = new Player(level.spawn.x, level.spawn.y - spawnOffsetY, this.worldScale);
    player.mount(world);
    this.player = player;
    const enemies = level.enemies ?? [];
    this.enemies = enemies.map((enemyPoint: LevelEnemy) => {
      const enemyType =
        enemyPoint.enemyType ?? (enemyPoint.behavior === "patrol" ? "patrol" : "static");
      const behavior = enemyType === "patrol" ? "patrol" : "idle";
      const assetId = enemyType === "static" ? "crystal" : "slime";
      const enemy = new Enemy(
        enemyPoint.x,
        enemyPoint.y - spawnOffsetY,
        this.worldScale,
        {
          behavior,
          patrolRange: enemyPoint.patrolRange,
          patrolSpeed: enemyPoint.patrolSpeed,
          idleDuration: enemyPoint.idleDuration,
          gravityEnabled: enemyPoint.gravityEnabled ?? true,
          assetId,
        },
      );
      enemy.mount(world);
      enemy.resolveSpawn(this.platforms);
      return enemy;
    });
    world.addChild(effectsLayer);
    this.centerCameraOnPlayer();
    await player.loadAssets();
    await Promise.all(this.enemies.map((enemy) => enemy.loadAssets()));
    if (token !== this.enterToken) {
      abort();
      return;
    }

    void audioManager.crossfadeBgm(whitePalaceBgmPath, {
      durationMs: 500,
      loop: true,
    });

    this.app = app;
    this.collectibles = new Collectible(runtime, {
      worldScale: this.worldScale,
      onCollect: (count, total) => this.onCoinChange?.(count, total),
    });
    this.collectibles.setCoins(level.coins);
    this.levelCleared = false;
    this.elapsedSeconds = 0;
    this.centerCameraOnPlayer();
    this.gameRoot.visible = true;
    if (this.player) {
      this.onHealthChange?.(this.player.getHealth(), this.player.getMaxHealth());
    }
    this.onTimeChange?.(this.elapsedSeconds);
    this.onReady?.();

    this.keyDownHandler = (event) => {
      if (event.repeat) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        this.keyboardInput.moveX = -1;
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        this.keyboardInput.moveX = 1;
      }

      if (event.key === " ") {
        if (!this.keyboardInput.jumpHeld) {
          this.keyboardInput.jumpDown = true;
        }
        this.keyboardInput.jumpHeld = true;
      }

      if (event.key.toLowerCase() === "j" || event.key.toLowerCase() === "k") {
        if (!this.keyboardInput.attackHeld) {
          this.keyboardInput.attackDown = true;
        }
        this.keyboardInput.attackHeld = true;
      }

      if (event.key === "Escape") {
        if (this.isPlaytest) {
          this.exitPlaytest();
        } else {
          this.onRequestExit?.();
        }
      }
    };

    this.keyUpHandler = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        if (this.keyboardInput.moveX < 0) {
          this.keyboardInput.moveX = 0;
        }
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        if (this.keyboardInput.moveX > 0) {
          this.keyboardInput.moveX = 0;
        }
      }

      if (event.key === " ") {
        this.keyboardInput.jumpHeld = false;
      }

      if (event.key.toLowerCase() === "j" || event.key.toLowerCase() === "k") {
        this.keyboardInput.attackHeld = false;
      }
    };

    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);

    this.tickerHandler = () => {
      if (!this.app || !this.player) {
        return;
      }

      const deltaSeconds = this.app.ticker.deltaMS / 1000;
      const virtualState = this.virtualInput?.consumeFrame() ?? {
        moveX: 0,
        jumpDown: false,
        jumpHeld: false,
        attackDown: false,
        attackHeld: false,
      };
      const gamepadState = this.inputHelper.readGamepad();
      const mergedInput: VirtualInputState = {
        moveX:
          Math.abs(virtualState.moveX) > Math.abs(this.keyboardInput.moveX)
            ? virtualState.moveX
            : this.keyboardInput.moveX,
        jumpDown: this.keyboardInput.jumpDown || virtualState.jumpDown,
        jumpHeld: this.keyboardInput.jumpHeld || virtualState.jumpHeld,
        attackDown: this.keyboardInput.attackDown || virtualState.attackDown,
        attackHeld: this.keyboardInput.attackHeld || virtualState.attackHeld,
      };
      mergedInput.moveX =
        Math.abs(gamepadState.moveX) > Math.abs(mergedInput.moveX)
          ? gamepadState.moveX
          : mergedInput.moveX;
      mergedInput.jumpDown = mergedInput.jumpDown || gamepadState.jumpDown;
      mergedInput.jumpHeld = mergedInput.jumpHeld || gamepadState.jumpHeld;
      mergedInput.attackDown = mergedInput.attackDown || gamepadState.attackDown;
      mergedInput.attackHeld = mergedInput.attackHeld || gamepadState.attackHeld;
      if (!this.inputEnabled) {
        mergedInput.moveX = 0;
        mergedInput.jumpDown = false;
        mergedInput.jumpHeld = false;
        mergedInput.attackDown = false;
        mergedInput.attackHeld = false;
      }
      const controlLocked = this.deathState !== "none" || this.player.isControlLocked();
      if (controlLocked) {
        mergedInput.moveX = 0;
        mergedInput.jumpDown = false;
        mergedInput.jumpHeld = false;
        mergedInput.attackDown = false;
        mergedInput.attackHeld = false;
      }

      this.keyboardInput.jumpDown = false;
      this.keyboardInput.attackDown = false;
      this.inputState.move = mergedInput.moveX;
      this.inputState.jump = mergedInput.jumpDown;

      if (controlLocked) {
        this.homingTarget = null;
        this.updateHomingReticle(null);
      } else {
        this.homingTarget = this.findHomingTarget();
        this.updateHomingReticle(this.homingTarget);
      }

      if (this.deathState !== "none") {
        this.inputState.attack = false;
        this.player.update(deltaSeconds, this.inputState, this.platforms);
        this.updateHomingTrails(deltaSeconds);
        this.updateHitEffects(deltaSeconds);
        this.updateDeathSequence(deltaSeconds);
        return;
      }

      if (this.hitStopTimer > 0) {
        this.hitStopTimer = Math.max(0, this.hitStopTimer - deltaSeconds);
        this.player.updateAttackTimers(deltaSeconds, false);
        this.updateSlashProjectiles(deltaSeconds);
        this.updateHomingTrails(deltaSeconds);
        this.updateHitEffects(deltaSeconds);
        return;
      }

      const attackHeld = mergedInput.attackHeld && this.inputEnabled;
      if (!attackHeld) {
        this.homingHoldLatch = false;
      } else if (!this.homingHoldLatch) {
        this.homingHoldLatch = true;
      }
      const canHoming =
        !this.player.grounded && this.homingTarget && this.player.canStartAttack();
      const homingTrigger = this.homingHoldLatch && canHoming;
      const attackTrigger = this.inputEnabled && (mergedInput.attackDown || homingTrigger);
      if (homingTrigger) {
        this.homingHoldLatch = false;
      }

      if (attackTrigger) {
        this.player.setNextAttackType(homingTrigger ? "homing" : "attack");
      } else {
        this.player.setNextAttackType(null);
      }
      this.inputState.attack = attackTrigger;

      this.player.update(deltaSeconds, this.inputState, this.platforms);
      if (!this.levelCleared && this.inputEnabled && this.deathState === "none") {
        this.elapsedSeconds += deltaSeconds;
        this.onTimeChange?.(this.elapsedSeconds);
      }
      for (const enemy of this.enemies) {
        enemy.update(deltaSeconds, this.platforms);
      }
      if (this.worldBounds) {
        this.player.clampToBounds(this.worldBounds, { clampY: false });
      }

      if (this.checkFallDeath()) {
        this.updateDeathSequence(deltaSeconds);
        return;
      }

      const diedFromContact = this.resolveEnemyContacts(deltaSeconds);
      if (diedFromContact) {
        this.updateDeathSequence(deltaSeconds);
        return;
      }
      if (attackTrigger && !this.player.grounded && this.homingTarget) {
        this.executeHomingAttack(this.homingTarget);
      }

      this.trySpawnSlashProjectile();
      this.resolveCombat();
      if (!this.player.isHomingAttackActive()) {
        this.homingAttackTarget = null;
      }
      this.updateSlashProjectiles(deltaSeconds);
      this.updateHomingTrails(deltaSeconds);
      this.collectibles?.update(this.player.getRect());
      this.checkLevelCompletion();
      this.updateHitEffects(deltaSeconds);

      if (this.world) {
        const viewCenterX = GAME_WIDTH * 0.5;
        const viewCenterY = GAME_HEIGHT * 0.5;
        const playerCenterX = this.player.position.x + this.player.width * 0.5;
        const playerCenterY = this.player.position.y + this.player.height * 0.5;
        const targetX = -playerCenterX + viewCenterX;
        const targetY = -playerCenterY + viewCenterY;
        const clamped = this.clampCamera(targetX, targetY);

        this.world.x += (clamped.x - this.world.x) * 0.08;
        this.world.y += (clamped.y - this.world.y) * 0.08;

        this.visuals?.update(this.world.x, this.world.y, GAME_WIDTH, GAME_HEIGHT);
      }
    };

    app.ticker.add(this.tickerHandler);
    // TODO: expand scene setup in Phase 5.
  }

  override onExit() {
    this.enterToken += 1;

    if (this.app && this.tickerHandler) {
      this.app.ticker.remove(this.tickerHandler);
      this.tickerHandler = null;
    }

    if (this.keyDownHandler) {
      window.removeEventListener("keydown", this.keyDownHandler);
      this.keyDownHandler = null;
    }

    if (this.keyUpHandler) {
      window.removeEventListener("keyup", this.keyUpHandler);
      this.keyUpHandler = null;
    }

    this.virtualInput?.reset();
    this.inputHelper.reset();

    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];

    if (this.runtime) {
      this.runtime.destroy();
      this.runtime = null;
    }

    if (this.visuals) {
      this.visuals.destroy();
      this.visuals = null;
    }

    if (this.background) {
      this.background.removeFromParent();
      this.background.destroy({ children: false });
      this.background = null;
    }

    if (this.world) {
      this.world.removeFromParent();
      this.world.destroy({ children: false });
      this.world = null;
    }

    if (this.effectsLayer) {
      this.effectsLayer.removeFromParent();
      this.effectsLayer.destroy({ children: true });
      this.effectsLayer = null;
    }
    this.homingReticle = null;
    if (this.deathOverlay) {
      this.deathOverlay.removeFromParent();
      this.deathOverlay.destroy();
      this.deathOverlay = null;
    }

    if (this.gameRoot) {
      this.gameRoot.removeFromParent();
      this.gameRoot.destroy({ children: false });
      this.gameRoot = null;
    }
    this.worldBounds = null;
    this.platforms = [];
    this.collectibles?.destroy();
    this.collectibles = null;
    this.levelCleared = false;
    this.elapsedSeconds = 0;
    this.hitEffects = [];
    this.hitStopTimer = 0;
    this.homingTarget = null;
    this.lastSlashAttackId = -1;
    for (const slash of this.slashProjectiles) {
      slash.graphic.removeFromParent();
      slash.graphic.destroy();
    }
    this.slashProjectiles = [];
    for (const trail of this.homingTrails) {
      trail.sprite.removeFromParent();
      trail.sprite.destroy();
    }
    this.homingTrails = [];
    this.homingAttackTarget = null;
    this.enemyContactTimer = 0;
    this.deathState = "none";
    this.deathFadeTimer = 0;

    if (this.app) {
      const canvas = this.app.canvas;
      this.app.destroy(true);
      this.app = null;
      canvas.remove();
    }

    this.keyboardInput = {
      moveX: 0,
      jumpDown: false,
      jumpHeld: false,
      attackDown: false,
      attackHeld: false,
    };
    this.inputState = { move: 0, jump: false, attack: false };

    if (this.isPlaytest && !this.isRestarting) {
      LevelSession.clearPreviewLevel();
    }
    this.isPlaytest = false;

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }

    super.onExit();
  }

  override update(_deltaMs: number) {
    // TODO: update gameplay once the loop is wired.
  }

  private clampCamera(targetX: number, targetY: number) {
    if (!this.app || !this.worldBounds) {
      return { x: targetX, y: targetY };
    }

    const minX = GAME_WIDTH - this.worldBounds.maxX;
    const maxX = -this.worldBounds.minX;
    const minY = GAME_HEIGHT - this.worldBounds.maxY;
    const maxY = -this.worldBounds.minY;

    return {
      x: Math.min(Math.max(targetX, minX), maxX),
      y: Math.min(Math.max(targetY, minY), maxY),
    };
  }

  private centerCameraOnPlayer() {
    if (!this.world || !this.player) {
      return;
    }
    const viewCenterX = GAME_WIDTH * 0.5;
    const viewCenterY = GAME_HEIGHT * 0.5;
    const playerCenterX = this.player.position.x + this.player.width * 0.5;
    const playerCenterY = this.player.position.y + this.player.height * 0.5;
    const targetX = -playerCenterX + viewCenterX;
    const targetY = -playerCenterY + viewCenterY;
    const clamped = this.clampCamera(targetX, targetY);
    this.world.x = clamped.x;
    this.world.y = clamped.y;
    this.visuals?.update(this.world.x, this.world.y, GAME_WIDTH, GAME_HEIGHT);
  }

  private checkLevelCompletion() {
    if (!this.player || !this.runtime || this.levelCleared) {
      return;
    }

    const goalRect = this.runtime.getGoalWorld();
    if (!goalRect) {
      return;
    }
    if (this.rectsOverlap(this.player.getRect(), goalRect)) {
      this.levelCleared = true;
      if (this.isPlaytest) {
        this.exitPlaytest();
        return;
      }
      this.onLevelClear?.();
    }
  }

  private exitPlaytest() {
    LevelSession.clearPreviewLevel();
    this.onRequestPlaytestExit?.();
  }

  private resolveCombat() {
    if (!this.player || this.enemies.length === 0) {
      return;
    }

    const hits = this.combat.update(this.player, this.enemies, this.homingAttackTarget);
    if (hits.length === 0) {
      return;
    }

    this.hitStopTimer = 0.05;
    this.playHitSound();
    for (const hit of hits) {
      this.spawnHitEffect(hit);
    }
  }

  private spawnHitEffect(hit: CombatHit) {
    if (!this.effectsLayer) {
      return;
    }

    const gfx = new Graphics();
    const radius = hit.attackType === "homing" ? 18 : 14;
    gfx.circle(0, 0, radius).fill(0xffe08a);
    gfx.circle(0, 0, radius + 6).stroke({ color: 0xffc15a, width: 2, alpha: 0.7 });
    gfx.x = hit.position.x;
    gfx.y = hit.position.y;
    this.effectsLayer.addChild(gfx);
    this.hitEffects.push({ graphic: gfx, ttl: 0.25, duration: 0.25 });
  }

  private resolveEnemyContacts(deltaSeconds: number): boolean {
    if (!this.player || this.enemies.length === 0) {
      return false;
    }

    if (
      this.player.isDead() ||
      this.deathState !== "none" ||
      this.player.isInvincible() ||
      this.player.isHomingAttackActive()
    ) {
      return false;
    }

    if (this.enemyContactTimer > 0) {
      this.enemyContactTimer = Math.max(0, this.enemyContactTimer - deltaSeconds);
      return false;
    }

    const playerRect = this.player.getRect();
    for (const enemy of this.enemies) {
      if (enemy.isDead()) {
        continue;
      }
      const enemyRect = enemy.getRect();
      if (!this.rectsOverlap(playerRect, enemyRect)) {
        continue;
      }

      const playerCenterX = playerRect.x + playerRect.width * 0.5;
      const enemyCenterX = enemyRect.x + enemyRect.width * 0.5;
      const direction = playerCenterX < enemyCenterX ? -1 : 1;
      const knockbackOffset = this.enemyContactKnockbackOffset * this.worldScale;
      const desiredX =
        direction < 0
          ? enemyRect.x - playerRect.width - knockbackOffset
          : enemyRect.x + enemyRect.width + knockbackOffset;
      const resolved = Physics.resolve(
        playerRect,
        { x: desiredX - playerRect.x, y: 0 },
        this.platforms,
      );
      this.player.position.x = resolved.x;
      this.player.position.y = resolved.y;
      this.player.velocity.x = direction * this.enemyContactKnockbackSpeed * this.worldScale;
      this.player.velocity.y = -this.player.getHomingBounceSpeed() * 0.6;
      this.player.grounded = false;
      const invincibilitySeconds = 1;
      this.player.applyDamage(1);
      const health = this.player.getHealth();
      this.onHealthChange?.(health, this.player.getMaxHealth());
      if (health <= 0) {
        this.player.triggerDeath();
        this.startDeathSequence("hit");
        return true;
      }
      this.player.triggerInvincibility(invincibilitySeconds);
      this.player.triggerHurt(invincibilitySeconds);
      this.enemyContactTimer = 0.35;
      break;
    }

    return false;
  }

  private updateHitEffects(deltaSeconds: number) {
    if (this.hitEffects.length === 0) {
      return;
    }

    for (const effect of this.hitEffects) {
      effect.ttl = Math.max(0, effect.ttl - deltaSeconds);
      const ratio = effect.duration > 0 ? effect.ttl / effect.duration : 0;
      effect.graphic.alpha = Math.max(0, Math.min(1, ratio));
    }

    this.hitEffects = this.hitEffects.filter((effect) => {
      if (effect.ttl > 0) {
        return true;
      }
      effect.graphic.removeFromParent();
      effect.graphic.destroy();
      return false;
    });
  }

  private playHitSound() {
    const now = performance.now();
    if (now - this.lastHitSoundAt < 80) {
      return;
    }
    this.lastHitSoundAt = now;

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    const context = this.audioContext;
    if (context.state === "suspended") {
      void context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(220, context.currentTime);
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
  }

  private findHomingTarget() {
    if (!this.player || this.player.grounded) {
      return null;
    }

    const radius = this.homingRadius * this.worldScale;
    const playerCenterX = this.player.position.x + this.player.width * 0.5;
    const playerCenterY = this.player.position.y + this.player.height * 0.5;
    let best: Enemy | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of this.enemies) {
      if (enemy.isDead()) {
        continue;
      }
      const rect = enemy.getRect();
      const centerX = rect.x + rect.width * 0.5;
      const centerY = rect.y + rect.height * 0.5;
      const dx = centerX - playerCenterX;
      const dy = centerY - playerCenterY;
      const distance = Math.hypot(dx, dy);
      if (distance <= radius && distance < bestDistance) {
        best = enemy;
        bestDistance = distance;
      }
    }

    return best;
  }

  private updateHomingReticle(target: Enemy | null) {
    if (!this.homingReticle) {
      return;
    }

    if (!target) {
      this.homingReticle.visible = false;
      return;
    }

    const rect = target.getRect();
    const centerX = rect.x + rect.width * 0.5;
    const centerY = rect.y + rect.height * 0.5;
    const radius = rect.width * 0.6;
    this.homingReticle.clear();
    this.homingReticle
      .circle(0, 0, radius)
      .stroke({ color: 0xfff2aa, width: 3, alpha: 0.85 })
      .moveTo(-radius * 0.8, 0)
      .lineTo(radius * 0.8, 0)
      .stroke({ color: 0xfff2aa, width: 2, alpha: 0.85 })
      .moveTo(0, -radius * 0.8)
      .lineTo(0, radius * 0.8)
      .stroke({ color: 0xfff2aa, width: 2, alpha: 0.85 });
    this.homingReticle.x = centerX;
    this.homingReticle.y = centerY;
    this.homingReticle.visible = true;
  }

  private trySpawnSlashProjectile() {
    if (!this.player || !this.effectsLayer) {
      return;
    }
    if (!this.player.isAttackActive()) {
      return;
    }
    if (this.homingAttackTarget) {
      return;
    }
    const attackId = this.player.getAttackSequence();
    if (this.player.getAttackHitType() === "homing") {
      return;
    }
    if (attackId === this.lastSlashAttackId) {
      return;
    }

    const rect = this.player.getRect();
    const facing = this.player.getFacingDirection();
    const width = rect.width * 1.2;
    const height = rect.height * 0.28;
    const startX = rect.x + rect.width * 0.5 + facing * rect.width * 0.65;
    const startY = rect.y + rect.height * 0.45;
    const speed = 300 * this.worldScale;

    const graphic = new Graphics();
    graphic.rect(-width * 0.5, -height * 0.5, width, height).fill({
      color: 0x9ee2ff,
      alpha: 0.85,
    });
    graphic.rect(-width * 0.5, -height * 0.5, width, height).stroke({
      color: 0xe9f6ff,
      width: 2,
      alpha: 0.9,
    });
    graphic.x = startX;
    graphic.y = startY;
    this.effectsLayer.addChild(graphic);

    this.slashProjectiles.push({
      graphic,
      x: startX,
      y: startY,
      vx: speed * facing,
      width,
      height,
      ttl: 0.7,
      hitTargets: new Set<Enemy>(),
    });

    this.lastSlashAttackId = attackId;
  }

  private updateSlashProjectiles(deltaSeconds: number) {
    if (this.slashProjectiles.length === 0) {
      return;
    }

    const playerRect = this.player?.getRect();
    const knockbackBase = playerRect?.width ?? 80;
    const knockbackY = playerRect ? -playerRect.height * 0.1 : -20;
    const fadeDuration = 0.18;

    for (const slash of this.slashProjectiles) {
      slash.ttl = Math.max(0, slash.ttl - deltaSeconds);
      slash.x += slash.vx * deltaSeconds;
      slash.graphic.x = slash.x;
      slash.graphic.y = slash.y;
      slash.graphic.alpha = slash.ttl <= fadeDuration ? slash.ttl / fadeDuration : 1;

      const hitbox = {
        x: slash.x - slash.width * 0.5,
        y: slash.y - slash.height * 0.5,
        width: slash.width,
        height: slash.height,
      };

      for (const enemy of this.enemies) {
        if (enemy.isDead() || slash.hitTargets.has(enemy)) {
          continue;
        }
        if (Physics.overlaps(hitbox, enemy.getRect())) {
          const knockbackX = Math.sign(slash.vx) * knockbackBase * 0.8;
          const hit = enemy.applyHit(1, { x: knockbackX, y: knockbackY });
          if (hit) {
            slash.hitTargets.add(enemy);
            this.playHitSound();
            this.spawnHitEffect({
              enemy,
              position: {
                x: hitbox.x + hitbox.width * 0.5,
                y: hitbox.y + hitbox.height * 0.5,
              },
              attackType: "attack",
            });
            slash.ttl = 0;
            break;
          }
        }
      }
    }

    this.slashProjectiles = this.slashProjectiles.filter((slash) => {
      if (slash.ttl > 0) {
        return true;
      }
      slash.graphic.removeFromParent();
      slash.graphic.destroy();
      return false;
    });
  }

  private spawnHomingTrail(
    start: { x: number; y: number },
    end: { x: number; y: number },
    thickness: number,
    pickupStart: { x: number; y: number },
    pickupEnd: { x: number; y: number },
    pickupThickness: number,
  ) {
    if (!this.effectsLayer || !this.player) {
      return;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= 1) {
      return;
    }

    const spacing = Math.max(12, this.player.width * 0.55);
    const count = Math.min(10, Math.max(4, Math.ceil(length / spacing)));
    const sprites: Sprite[] = [];
    const baseAlphas: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 1 : i / (count - 1);
      const sprite = this.player.createTrailSprite();
      if (!sprite) {
        continue;
      }
      sprite.x = start.x + dx * t;
      sprite.y = start.y + dy * t;
      sprite.tint = 0x5ca6ff;
      const baseAlpha = 0.12 + (0.7 - 0.12) * t;
      sprite.alpha = baseAlpha;
      sprites.push(sprite);
      baseAlphas.push(baseAlpha);
      this.effectsLayer.addChild(sprite);
    }

    if (sprites.length === 0) {
      return;
    }

    this.homingTrails.push({
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
      pickupStart: { x: pickupStart.x, y: pickupStart.y },
      pickupEnd: { x: pickupEnd.x, y: pickupEnd.y },
      halfThickness: thickness * 0.5,
      pickupHalfThickness: pickupThickness * 0.5,
      sprites,
      baseAlphas,
      ttl: this.homingTrailDuration,
      duration: this.homingTrailDuration,
    });
  }

  private updateHomingTrails(deltaSeconds: number) {
    if (this.homingTrails.length === 0) {
      return;
    }

    for (const trail of this.homingTrails) {
      trail.ttl = Math.max(0, trail.ttl - deltaSeconds);
      const ratio = trail.duration > 0 ? trail.ttl / trail.duration : 0;
      const fade = Math.max(0, Math.min(1, ratio));
      for (let i = 0; i < trail.sprites.length; i += 1) {
        trail.sprites[i].alpha = trail.baseAlphas[i] * fade;
      }
      this.collectibles?.collectAlongSegment(
        trail.pickupStart,
        trail.pickupEnd,
        trail.pickupHalfThickness,
      );
    }

    this.homingTrails = this.homingTrails.filter((trail) => {
      if (trail.ttl > 0) {
        return true;
      }
      for (const sprite of trail.sprites) {
        sprite.removeFromParent();
        sprite.destroy();
      }
      return false;
    });
  }

  private executeHomingAttack(target: Enemy) {
    if (!this.player) {
      return;
    }

    const startCenterX = this.player.position.x + this.player.width * 0.5;
    const startBottomY = this.player.position.y + this.player.height;
    this.homingAttackTarget = target;
    this.player.triggerHomingAttackVisual();
    const rect = target.getRect();
    const targetCenterX = rect.x + rect.width * 0.5;
    const targetCenterY = rect.y + rect.height * 0.5;
    const playerCenterX = this.player.position.x + this.player.width * 0.5;
    const direction = targetCenterX >= playerCenterX ? 1 : -1;
    const lateralOffset = this.player.width * 0.25;
    this.player.setFacingDirection(direction);
    const desiredCenterX = targetCenterX - direction * lateralOffset;
    const desiredX = desiredCenterX - this.player.width * 0.5;
    const floorTop = this.getFloorTopAt(desiredX, desiredX + this.player.width);
    const enemyBottom = rect.y + rect.height;
    const desiredBottom =
      floorTop !== null ? Math.max(enemyBottom, floorTop) : enemyBottom;
    this.player.position.x = desiredX;
    this.player.position.y = desiredBottom - this.player.height;
    this.resolvePlayerHomingOverlap();
    const endCenterX = this.player.position.x + this.player.width * 0.5;
    const endBottomY = this.player.position.y + this.player.height;
    const pickupCenterOffset = this.player.height * 0.5;
    this.spawnHomingTrail(
      { x: startCenterX, y: startBottomY },
      { x: endCenterX, y: endBottomY },
      this.player.height * (1 / 3),
      { x: startCenterX, y: startBottomY - pickupCenterOffset },
      { x: endCenterX, y: endBottomY - pickupCenterOffset },
      this.player.height,
    );
    this.player.velocity.x = 0;
    this.player.velocity.y = -this.player.getHomingAttackBounceSpeed();
    this.player.triggerHomingInvincibility();
  }

  private resolvePlayerHomingOverlap() {
    if (!this.player) {
      return;
    }

    const maxIterations = 10;
    for (let step = 0; step < maxIterations; step += 1) {
      const rect = this.player.getRect();
      const overlap = this.platforms.find((solid) => Physics.overlaps(rect, solid));
      if (!overlap) {
        break;
      }
      this.player.position.y = overlap.y - this.player.height;
    }
  }

  private getFloorTopAt(xStart: number, xEnd: number) {
    let best: number | null = null;
    for (const solid of this.platforms) {
      const overlap = xStart < solid.x + solid.width && xEnd > solid.x;
      if (!overlap) {
        continue;
      }
      if (best === null || solid.y > best) {
        best = solid.y;
      }
    }
    return best;
  }

  private rectsOverlap(a: Rect, b: Rect) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  private checkFallDeath() {
    if (!this.player || !this.worldBounds || this.deathState !== "none") {
      return false;
    }

    const threshold = this.worldBounds.maxY + this.player.height;
    if (this.player.position.y > threshold) {
      this.startDeathSequence("fall");
      return true;
    }

    return false;
  }

  private startDeathSequence(mode: "hit" | "fall") {
    if (this.deathState !== "none") {
      return;
    }

    this.deathFadeTimer = 0;
    if (this.deathOverlay) {
      this.deathOverlay.alpha = 0;
    }
    this.deathState = mode === "hit" ? "waiting" : "fading";
  }

  private updateDeathSequence(deltaSeconds: number) {
    if (this.deathState === "waiting") {
      if (this.player?.isDeathSequenceComplete()) {
        this.deathState = "fading";
        this.deathFadeTimer = 0;
      }
      return;
    }

    if (this.deathState !== "fading") {
      return;
    }

    this.deathFadeTimer += deltaSeconds;
    const t = Math.min(1, this.deathFadeTimer / this.deathFadeDuration);
    if (this.deathOverlay) {
      this.deathOverlay.alpha = t;
    }
    if (t >= 1) {
      this.restartLevel();
    }
  }

  private restartLevel() {
    if (!this.host) {
      return;
    }
    this.isRestarting = true;
    this.onExit();
    this.isRestarting = false;
    void this.onEnter();
  }

  private async loadVisualsConfig(): Promise<VisualsConfig> {
    const response = await fetch(this.visualsConfigPath);
    if (!response.ok) {
      throw new Error(`Failed to load visuals config: ${this.visualsConfigPath}`);
    }
    const config = (await response.json()) as VisualsConfig;
    return normalizeVisualsConfig(config);
  }
}
