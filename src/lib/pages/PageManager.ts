import type { Page } from "./Page";

export class PageManager {
  private pages = new Map<string, Page>();
  private activePage: Page | null = null;

  register(page: Page) {
    this.pages.set(page.id, page);
  }

  get current() {
    return this.activePage;
  }

  goTo(id: string) {
    const nextPage = this.pages.get(id);
    if (!nextPage) {
      return;
    }

    if (this.activePage) {
      this.activePage.onExit();
    }

    this.activePage = nextPage;
    this.activePage.onEnter();
  }

  update(deltaMs: number) {
    if (!this.activePage) {
      return;
    }

    this.activePage.update(deltaMs);
  }
}
