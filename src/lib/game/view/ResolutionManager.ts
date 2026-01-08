import type { Application, Container } from "pixi.js";

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

export type ViewRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export class ResolutionManager {
  private readonly app: Application;
  private readonly gameRoot: Container;
  private viewRect: ViewRect = {
    x: 0,
    y: 0,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };

  constructor(app: Application, gameRoot: Container) {
    this.app = app;
    this.gameRoot = gameRoot;
  }

  get view() {
    return this.viewRect;
  }

  applyLayout(windowWidth: number, windowHeight: number) {
    const safeWidth = Math.max(1, Math.floor(windowWidth));
    const safeHeight = Math.max(1, Math.floor(windowHeight));
    const scale = Math.min(safeWidth / GAME_WIDTH, safeHeight / GAME_HEIGHT);
    const viewWidth = GAME_WIDTH * scale;
    const viewHeight = GAME_HEIGHT * scale;
    const offsetX = (safeWidth - viewWidth) / 2;
    const offsetY = (safeHeight - viewHeight) / 2;

    this.app.renderer.resize(safeWidth, safeHeight);
    this.gameRoot.scale.set(scale);
    this.gameRoot.position.set(offsetX, offsetY);

    this.viewRect = {
      x: 0,
      y: 0,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      scale,
      offsetX,
      offsetY,
    };
  }

  applyLayoutWithExtras(
    windowWidth: number,
    windowHeight: number,
    extraRoots: Container[],
  ) {
    this.applyLayout(windowWidth, windowHeight);
    for (const root of extraRoots) {
      root.scale.set(this.viewRect.scale);
      root.position.set(this.viewRect.offsetX, this.viewRect.offsetY);
    }
  }
}
