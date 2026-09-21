const CACHE_NAME = "theme-images-v1";
const UNSPLASH_ACCESS_KEY = window.WORDGAME_UNSPLASH_ACCESS_KEY ?? null;
const APP_NAME = "wordwheel";

function themeColorFallback(themeId) {
  let hash = 0;
  for (const ch of themeId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return `linear-gradient(160deg, hsl(${hue}, 55%, 22%), hsl(${(hue + 40) % 360}, 55%, 12%))`;
}

export class ThemeLoader {
  constructor(progressStore) {
    this.progressStore = progressStore;
  }

  async getBackgroundFor(round) {
    const cacheKey = `theme-image://${round.roundId}`;

    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(cacheKey);
      if (cached) {
        const blob = await cached.blob();
        return {
          imageUrl: URL.createObjectURL(blob),
          attribution: this.progressStore.getThemeCache(round.roundId)?.attribution ?? null,
        };
      }
    } catch (err) {
      // Cache API unavailable (e.g. private browsing) - fall through to network/placeholder.
    }

    if (!UNSPLASH_ACCESS_KEY || !navigator.onLine) {
      return { imageUrl: null, gradient: themeColorFallback(round.themeId), attribution: null };
    }

    try {
      return await this._fetchAndCache(round, cacheKey);
    } catch (err) {
      return { imageUrl: null, gradient: themeColorFallback(round.themeId), attribution: null };
    }
  }

  async _fetchAndCache(round, cacheKey) {
    const query = encodeURIComponent(round.unsplashQuery);
    const searchRes = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=5`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );
    const searchData = await searchRes.json();
    const photo = searchData.results?.[0];
    if (!photo) throw new Error("No Unsplash results");

    const imageRes = await fetch(photo.urls.regular);
    const imageBlob = await imageRes.blob();

    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheKey, new Response(imageBlob));

    fetch(`${photo.links.download_location}?client_id=${UNSPLASH_ACCESS_KEY}`).catch(() => {});

    const attribution = {
      name: photo.user.name,
      profileUrl: `${photo.user.links.html}?utm_source=${APP_NAME}&utm_medium=referral`,
    };
    await this.progressStore.setThemeCache(round.roundId, { photoId: photo.id, attribution, cachedAt: Date.now() });

    return { imageUrl: URL.createObjectURL(imageBlob), attribution };
  }
}
