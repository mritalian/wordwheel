import { Storage } from "../core/Storage.js";

export class SettingsScreen {
  constructor(rootEl, params, router) {
    this.rootEl = rootEl;
    this.router = router;
  }

  mount() {
    this.el = document.createElement("div");
    this.el.className = "screen list-screen";
    this.el.innerHTML = `
      <h1>Settings</h1>
      <button data-action="reset">Reset progress</button>
      <button data-action="back">Back</button>
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
