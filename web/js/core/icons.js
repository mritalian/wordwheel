// Inline SVGs, not a font glyph - a text arrow character rendered
// inconsistently (or not at all) across devices/fonts; SVG is pixel-perfect
// everywhere. Paths are Google's Material Icons (Apache 2.0, no attribution
// required): https://github.com/google/material-design-icons
export const BACK_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' +
  '<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
