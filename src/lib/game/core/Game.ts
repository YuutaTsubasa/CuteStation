import { Application } from "pixi.js";

export class Game {
  private app: Application | null = null;

  async mount(container: HTMLElement) {
    if (this.app) {
      return;
    }

    const app = new Application();
    await app.init({ background: "#0b0b0b", resizeTo: container });
    container.appendChild(app.canvas);
    this.app = app;
  }

  destroy() {
    if (!this.app) {
      return;
    }

    this.app.destroy(true);
    this.app = null;
  }
}
