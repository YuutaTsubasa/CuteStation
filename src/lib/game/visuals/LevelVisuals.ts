import { Assets, Container, Sprite, Texture, TilingSprite } from "pixi.js";
import type { LevelData, LevelRect } from "../levels/LevelLoader";
import type { LevelRuntime } from "../levels/LevelRuntime";
import type { VisualsConfig } from "./VisualsConfig";

export type LevelVisualsOptions = {
  worldScale: number;
  backgroundPaths: {
    far: string;
    mid: string;
    near: string;
  };
  platformTilePath: string;
  config: VisualsConfig;
};

type BackgroundLayers = {
  far: Sprite;
  mid: TilingSprite;
  near?: TilingSprite;
};

type SolidVisual = {
  rect: LevelRect;
  sprite: TilingSprite;
};

export class LevelVisuals {
  private readonly level: LevelData;
  private readonly runtime: LevelRuntime;
  private readonly options: LevelVisualsOptions;
  private background: BackgroundLayers | null = null;
  private solids: SolidVisual[] = [];
  private backgroundContainer: Container | null = null;
  private worldContainer: Container | null = null;
  private solidsContainer: Container | null = null;

  constructor(level: LevelData, runtime: LevelRuntime, options: LevelVisualsOptions) {
    this.level = level;
    this.runtime = runtime;
    this.options = options;
  }

  async load(viewWidth: number, viewHeight: number) {
    const includeNear = this.options.config.layers?.nearEnabled ?? false;
    const textures = await Promise.all([
      Assets.load<Texture>(this.options.backgroundPaths.far),
      Assets.load<Texture>(this.options.backgroundPaths.mid),
      includeNear ? Assets.load<Texture>(this.options.backgroundPaths.near) : null,
      Assets.load<Texture>(this.options.platformTilePath),
    ]);

    const far = textures[0] as Texture;
    const mid = textures[1] as Texture;
    const near = textures[2] as Texture | null;
    const tile = textures[3] as Texture;

    this.background = this.createBackground(viewWidth, viewHeight, far, mid, near);
    this.solids = this.createSolids(tile);
  }

  attach(backgroundContainer: Container, worldContainer: Container) {
    this.backgroundContainer = backgroundContainer;
    this.worldContainer = worldContainer;

    if (this.background) {
      backgroundContainer.addChild(this.background.far);
      backgroundContainer.addChild(this.background.mid);
      if (this.background.near) {
        backgroundContainer.addChild(this.background.near);
      }
    }

    const solidsContainer = new Container();
    worldContainer.addChildAt(solidsContainer, 0);
    this.solidsContainer = solidsContainer;

    for (const solid of this.solids) {
      solidsContainer.addChild(solid.sprite);
    }
  }

  update(cameraX: number, cameraY: number, viewWidth: number, viewHeight: number) {
    if (!this.background) {
      return;
    }

    const marginX = viewWidth * 0.1;
    const marginY = viewHeight * 0.1;
    const far = this.background.far;

    const worldWidth = this.level.world.width * this.options.worldScale;
    const worldHeight = this.level.world.height * this.options.worldScale;
    const farWidth = Math.max(viewWidth + marginX * 2, worldWidth + marginX * 2);
    const farHeight = Math.max(viewHeight + marginY * 2, worldHeight + marginY * 2);

    far.width = farWidth;
    far.height = farHeight;
    far.x =
      (viewWidth - farWidth) * 0.5 +
      cameraX * this.options.config.parallax.far;
    far.y = (viewHeight - farHeight) * 0.5;

    this.background.mid.width = viewWidth;
    this.background.mid.height = viewHeight;
    this.background.mid.tilePosition.set(
      cameraX * this.options.config.parallax.mid,
      cameraY *
        this.options.config.parallax.mid *
        (this.options.config.parallax.midYScale ?? 1),
    );

    if (this.background.near) {
      this.background.near.width = viewWidth;
      this.background.near.height = viewHeight;
      this.background.near.tilePosition.set(
        cameraX * (this.options.config.parallax.near ?? 0.8),
        cameraY * (this.options.config.parallax.near ?? 0.8),
      );
    }
  }

  destroy() {
    if (this.background) {
      this.background.far.destroy();
      this.background.mid.destroy();
      this.background.near?.destroy();
      this.background = null;
    }

    for (const solid of this.solids) {
      solid.sprite.destroy();
    }
    this.solids = [];
    this.solidsContainer?.destroy({ children: false });
    this.solidsContainer = null;

    this.backgroundContainer = null;
    this.worldContainer = null;
  }

  private createBackground(
    viewWidth: number,
    viewHeight: number,
    far: Texture,
    mid: Texture,
    near: Texture | null,
  ) {
    const marginX = viewWidth * 0.1;
    const marginY = viewHeight * 0.1;

    const farSprite = new Sprite(far);
    farSprite.width = viewWidth + marginX * 2;
    farSprite.height = viewHeight + marginY * 2;
    farSprite.x = -marginX;
    farSprite.y = -marginY;

    const midSprite = new TilingSprite({ texture: mid, width: viewWidth, height: viewHeight });
    const nearSprite = near
      ? new TilingSprite({ texture: near, width: viewWidth, height: viewHeight })
      : undefined;

    return { far: farSprite, mid: midSprite, near: nearSprite };
  }

  private createSolids(tile: Texture) {
    const solids: SolidVisual[] = [];
    const groundHeight = this.options.config.groundHeight;
    const tileHeight = tile.source.height;
    const decorationHeight = Math.max(0, tileHeight - groundHeight);
    for (const solid of this.level.solids) {
      const worldRect = this.runtime.toWorldRect(solid);
      const scale = worldRect.height / groundHeight;
      const decorationScaled = decorationHeight * scale;
      const sprite = new TilingSprite({
        texture: tile,
        width: worldRect.width,
        height: tileHeight * scale,
      });
      sprite.roundPixels = true;
      sprite.tileScale.set(scale, scale);
      sprite.tilePosition.y = 0;
      sprite.x = worldRect.x;
      sprite.y = worldRect.y - decorationScaled;
      solids.push({ rect: solid, sprite });
    }
    return solids;
  }
}
