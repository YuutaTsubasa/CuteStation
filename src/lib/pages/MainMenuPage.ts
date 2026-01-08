import { audioManager } from "../game/audio/AudioManager";
import { menuBgmPath } from "../game/audio/audioPaths";
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
    audioManager.stopBgm({ fadeOutMs: 200 });
    void audioManager.playBgm(menuBgmPath, { loop: true, crossfadeMs: 400 });
  }

  override onExit() {
    super.onExit();
  }
}
