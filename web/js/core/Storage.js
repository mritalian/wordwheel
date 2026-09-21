export class Storage {
  async get(key) {
    return localStorage.getItem(key);
  }

  async set(key, value) {
    localStorage.setItem(key, value);
  }
}
