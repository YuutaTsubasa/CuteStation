import { audioManager } from "../game/audio/AudioManager";
import { settingsBgmPath } from "../game/audio/audioPaths";
import { Page } from "./Page";

export class SettingsPage extends Page {
  constructor() {
    super("Settings");
  }

  override onEnter() {
    super.onEnter();
    void audioManager.playBgm(settingsBgmPath, { loop: true, crossfadeMs: 400 });
  }
}
