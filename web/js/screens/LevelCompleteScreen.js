export class LevelCompleteScreen {
  constructor(rootEl, params, router) {
    this.rootEl = rootEl;
    this.params = params;
    this.router = router;
  }

  mount() {
    this.el = document.createElement("div");
    this.el.className = "screen complete-screen";
    const bonusHtml = this.params.bonusWords.length
      ? this.params.bonusWords.map((w) => `<span class="bonus-word-tag">${w}</span>`).join("")
      : "<em>No bonus words found</em>";
    this.el.innerHTML = `
      <h1>Level Complete!</h1>
      <p>Words found: ${this.params.words.join(", ")}</p>
      <div>${bonusHtml}</div>
      <button data-action="continue">Continue</button>
    `;
    this.rootEl.appendChild(this.el);
    this.el.querySelector('[data-action="continue"]').addEventListener("click", () => {
      this.router.goTo("levelSelect", { roundId: this.params.roundId });
    });
  }

  teardown() {}
}
