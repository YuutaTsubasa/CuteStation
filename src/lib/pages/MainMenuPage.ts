import { Page } from "./Page";

type MenuEntry = {
  id: string;
  label: string;
};

export class MainMenuPage extends Page {
  readonly entries: MenuEntry[] = [
    { id: "GamePlay", label: "Start Game" },
    { id: "LevelEditor", label: "Level Editor" },
  ];

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
