const CONTENT_BASE = "assets/content";

function themeColorFallback(themeId) {
  let hash = 0;
  for (const ch of themeId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return `linear-gradient(160deg, hsl(${hue}, 55%, 22%), hsl(${(hue + 40) % 360}, 55%, 12%))`;
}

// The theme photo is fetched once at content-generation time (see
// content-tools/generator/theme_images.py) and bundled as a static asset -
// the client never calls Unsplash or holds an API key. `round.backgroundImage`
// is only present when the round was generated with an Unsplash access key.
export class ThemeLoader {
  async getBackgroundFor(round) {
    if (round.backgroundImage) {
      return {
        imageUrl: `${CONTENT_BASE}/${round.backgroundImage}`,
        attribution: round.attribution ?? null,
      };
    }
    return { imageUrl: null, gradient: themeColorFallback(round.themeId), attribution: null };
  }
}
