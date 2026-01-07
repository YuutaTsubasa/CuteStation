import { Page } from "./Page";

export class MainMenuPage extends Page {
  constructor() {
    super("MainMenu");
  }

  override onEnter() {
    super.onEnter();
    // TODO: add menu layout and interactions in Phase 2.
  }

  override onExit() {
    // TODO: cleanup menu resources in Phase 2.
    super.onExit();
  }
}
