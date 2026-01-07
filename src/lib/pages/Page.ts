export class Page {
  readonly id: string;
  isActive = false;

  constructor(id: string) {
    this.id = id;
  }

  onEnter() {
    this.isActive = true;
  }

  onExit() {
    this.isActive = false;
  }

  update(_deltaMs: number) {
    // Override in subclasses when the game loop is available.
  }
}
