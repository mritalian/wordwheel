import { Storage } from "../core/Storage.js";
import { BACK_ICON_SVG } from "../core/icons.js";

export class SettingsScreen {
  constructor(rootEl, params, router) {
    this.rootEl = rootEl;
    this.router = router;
  }

  mount() {
    this.el = document.createElement("div");
    this.el.className = "screen list-screen";
    this.el.innerHTML = `
      <div class="back-fab" data-action="back" role="button" tabindex="0">${BACK_ICON_SVG}</div>
      <h1>Settings</h1>
      <div class="btn" data-action="reset" role="button" tabindex="0">Reset progress</div>
    `;
    this.rootEl.appendChild(this.el);

    this.el.querySelector('[data-action="reset"]').addEventListener("click", async () => {
      const storage = new Storage();
      await storage.set("wordgame.progress.v1", "");
      this.router.goTo("ladderSelect");
    });
    this.el.querySelector('[data-action="back"]').addEventListener("click", () => {
      this.router.goTo("ladderSelect");
    });
  }

  teardown() {}
}
