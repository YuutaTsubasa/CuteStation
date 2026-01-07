import { Page } from "./Page";

export class SplashScreenPage extends Page {
  constructor() {
    super("SplashScreen");
  }

  override onEnter() {
    super.onEnter();
    // TODO: add splash screen visuals and timing in Phase 2.
  }

  override onExit() {
    // TODO: cleanup splash screen resources in Phase 2.
    super.onExit();
  }
}
