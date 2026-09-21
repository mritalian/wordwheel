// Wraps the standard Vibration API - works in the Capacitor/Android WebView
// (needs android.permission.VIBRATE, already in AndroidManifest.xml) and
// degrades to a silent no-op wherever unsupported (desktop browsers, iOS
// Safari). This is feel enhancement, not a requirement, so no fallback lib.
function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

export const Haptics = {
  tap() {
    vibrate(10);
  },
  match() {
    vibrate([20, 30, 20]);
  },
  miss() {
    vibrate([0, 40, 30, 40]);
  },
};
