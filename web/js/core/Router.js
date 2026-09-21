export class Router {
  constructor(screens, rootEl) {
    this.screens = screens;
    this.rootEl = rootEl;
    this.current = null;
  }

  goTo(screenName, params = {}) {
    this.current?.teardown?.();
    this.rootEl.innerHTML = "";
    const ScreenClass = this.screens[screenName];
    if (!ScreenClass) throw new Error(`Unknown screen: ${screenName}`);
    this.current = new ScreenClass(this.rootEl, params, this);
    this.current.mount();
  }
}
