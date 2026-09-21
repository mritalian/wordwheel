# Word Wheel

A Wordscapes-style word game: a crossword-style grid (top half of the screen)
whose words are spelled by tracing letters on a circular wheel (bottom half).
Progression is organized into themed "ladders" of rounds (3-letter, 4-letter,
two 5-letter, two 6-letter rounds, repeating), each round with a themed photo
background (Amazon rainforest, flowers, Italy, etc).

Full design plan (context, decisions, schema, build order): see the plan
written during scoping - if you don't have it, ask for a re-summary; the key
decisions are repeated below.

## Key decisions

- **No native Android/Kotlin/Flutter/Unity.** The game is a plain HTML/CSS/
  vanilla-JS web app, rendered entirely on `<canvas>`. It runs standalone in
  any desktop/mobile browser, and gets wrapped for Play Store distribution
  with **Capacitor** (thin native WebView shell).
- **Content**: pre-generated as static JSON, produced by an offline Python
  generator (`content-tools/`), not hand-authored. Designed as a "hybrid"
  strategy - bundle a starter pack now, swap in a backend later without
  client changes (the JSON schema is transport-agnostic).
- **Theme photos**: Unsplash API, fetched by keyword *at content-generation
  time* (not runtime) and bundled as a static asset - the client never calls
  Unsplash or holds an API key. Required photographer attribution is baked
  into the round JSON alongside the image path.

## Repo layout

```
web/                  the game itself (ships to browser AND Capacitor)
  index.html, css/, js/
  assets/content/      level/round/ladder/theme JSON (bundled starter pack)
content-tools/         offline level generator (Python) - NOT shipped in the app
  generator/           wordlist.py, grid_builder.py, wheel.py, bonus_words.py,
                        level_builder.py, curate.py, cli.py
  data/enable1.txt     vendored dictionary (legality checker)
  config/              theme registry, per-theme word pools, generation params
content/generated/     curated output of the generator (levels/rounds/images),
                        the source of truth copied into web/assets/content/
content/candidates/    oversupply batch before curation (gitignored)
capacitor.config.json  webDir: "web" - Android wrapper config
```

## Running the web app

No build step - it's plain ES modules loaded directly by `index.html`.
`fetch()` of local JSON is blocked under `file://` in most browsers, so serve
it with any static file server:

```bash
npm run dev   # npx http-server web -p 8090 -c-1
```

(Avoid Python's `http.server` on Windows - it does a reverse-DNS lookup per
request that can hang indefinitely. Port 8090 is used instead of the more
common 8080 since that's already bound by other apps - e.g. VS Code - on at
least one dev machine this project has been worked on.)

Then open `http://localhost:8090`. You should land on the ladder-select
screen; the one bundled round so far is "Amazon Rainforest" (5-letter, 10
levels). Click into a level, tap a wheel letter and drag across others to
trace a word - matches fill the crossword, real-but-unplaced words count as
bonus finds, invalid traces shake and reset.

**Scripted browser testing**: `playwright` (pinned to `1.48.0` for Node 18
compatibility - later versions require Node 20+) is a devDependency. Useful
for automated click-through checks, e.g. if the Claude-in-Chrome extension
is unavailable (`npx playwright install chromium` once, then drive it with a
small script - `chromium.launch()`, `page.goto()`, `page.mouse` for wheel
drags, `page.screenshot()`).

**Status as of this checkpoint**: the client has been exercised in an actual
browser (Playwright-driven Chromium, since the Claude-in-Chrome extension has
an unresolved upstream CSP bug on this machine - see below). Ladder-select,
level-select, and gameplay navigation all work; wheel drag-tracing correctly
fills grid words and detects bonus words; invalid traces are correctly
rejected. Two bugs turned up and were fixed:

- `web/css/styles.css`: `.gameplay-screen` had a redundant `position:
  relative` that overrode `.screen`'s `position: absolute; inset: 0`,
  collapsing the canvas container (and both canvases) to zero height, so
  nothing rendered. Removed.
- Mid-level progress (words/bonus words found) wasn't persisted until a level
  was fully completed, so reloading or backing out of an unfinished level
  lost all progress in it. `ProgressStore` now has `getLevelState`/
  `saveLevelState`, `GameState` has `restore()`, and `GameplayScreen` saves
  after every word/bonus find and restores on mount.

Not a bug, just cosmetic: there's a 404 in the console on every load - it's
the browser's automatic `favicon.ico` request; there's no favicon file or
`<link rel="icon">` yet.

**Navigation is two-tier, not three**: ladder-select shows one card per
*theme* (not per round/word-length - `LadderSelectScreen`), and level-select
shows every level across all of that theme's rounds as one flat, sequential
list (`LadderConfig.getFlattenedLevels` concatenates each round's levelIds
in ladder order; `LevelSelectScreen` never groups or labels by round or word
length). Round/word-length boundaries still exist in the data (content is
still generated and stored per-round) but are entirely invisible to the
player - a level's position is just "N out of however many the theme has,"
and levels unlock strictly in order across that whole flattened sequence,
ignoring round boundaries. Each theme's ladder unlocks independently
starting from its own first level - themes aren't chained together, so e.g.
Flowers doesn't stay locked behind finishing Amazon Rainforest.

**Level-complete** is an overlay on the just-finished gameplay screen (the
filled grid stays visible, dimmed, behind it) rather than a separate routed
screen - "Continue" goes straight to the next level in the flattened
sequence, transparently crossing from one round into the next when that's
the boundary being crossed (e.g. finishing the last 3-letter level continues
straight into the first 4-letter level, no round-select screen in between).

**Ladder-select and level-select** both use the themes' own bundled photos
now instead of plain dark panels: ladder-select shows each theme as a photo
tile (`.theme-card`, background from that theme's first round), level-select
uses the theme's photo as a full-screen backdrop (scrimmed for legibility)
behind a flat grid of circular numbered badges - same `_applyBackground`
pattern as `GameplayScreen`, now shared via the renamed `.screen__attribution`
class (was `.gameplay-screen__attribution`, gameplay-specific naming no
longer fit once level-select needed the same attribution link).

**Wheel input**: each physical wheel node can only be used once per trace,
even revisited non-consecutively (drag A→B→C→A used to silently double-count
A) - two nodes sharing a letter (e.g. two G tiles) are still independently
usable, since they're different physical circles.

**Grid tile color** is teal/emerald (`rgba(20,184,166,1)` fill), not
pink/magenta - an earlier pass matched reference screenshots too closely,
and those references are competing apps.

## Content generator

```bash
cd content-tools
pip install -r requirements.txt   # wordfreq + nltk
python3 -m generator.cli \
  --theme amazon_rainforest --round-id amazon_rainforest_r1 \
  --length 5 --count 300 --keep 10
```

First run downloads the NLTK Brown Corpus (~5MB, cached locally after that -
see "Algorithm" below for why it's needed).

This generates `--count` candidate levels (oversupply), curates down to
`--keep`, and writes level JSON + a round JSON to `content/generated/` (see
`cli.py --help` for all options: `--theme-display-name`, `--unsplash-query`,
`--out`, `--seed`).

After generating, copy the results into the web app's bundled assets:

```bash
cp content/generated/levels/*.json web/assets/content/levels/
cp content/generated/rounds/*.json web/assets/content/rounds/
cp -r content/generated/images/. web/assets/content/images/   # only if a theme photo was fetched
```

(This copy step is manual for now - worth scripting once there's more than
one theme in flight.)

**Theme photo (optional)**: copy `content-tools/.env.example` to
`content-tools/.env` (gitignored) and fill in `UNSPLASH_ACCESS_KEY` - the CLI
auto-loads it, so nothing needs passing on the command line. (`--unsplash-
access-key <key>` also works directly, and a real shell-exported
`UNSPLASH_ACCESS_KEY` always wins over the `.env` file.) With a key present,
the generator fetches one photo for the theme via the Unsplash API, writes it
to `content/generated/images/<theme>.jpg` plus a matching
`<theme>.attribution.json`, and bakes `backgroundImage`/`attribution` fields
into the round JSON. Runs once per theme - if the image/attribution files
already exist on disk, it skips the network call. Omit the key and the round
just falls back to a per-theme gradient background client-side (see
`web/js/theme/ThemeLoader.js`) - the client itself never calls Unsplash or
needs a key.

**Algorithm, in short** (see docstrings in `content-tools/generator/` for
detail): pick a small letter multiset first (an "anchor" word), find every
real dictionary word spellable from exactly that multiset, then pack a
subset of those into an interlocking grid via backtracking. This is
deliberately wheel-first, not words-first - building words first and merging
their letters was tried and discarded because it produced 15+ letter wheels
and thousands of bonus words, nothing like the tight, authentic Wordscapes
wheel. Legality is ENABLE1 for both tiers.

The wheel is *exactly* the anchor word's own letters (no padding with extra
"flavor" tiles - an earlier version did that and it meant the wheel could
have tiles no placed word ever used). The anchor is force-placed as the grid
seed word (`required_word` in `grid_builder.build_interlocking_set`), so
every generated level guarantees at least one placed word using every wheel
tile - if the wheel has N letters, one grid word is N letters long.

Puzzle *answer* words (placed in the grid) and *bonus* words (found by
accident, not placed) use different commonness bars. Bonus words only need a
`wordfreq` zipf score above `BONUS_WORD_ZIPF` - obscurity there is a feature.
Answer words need that too (`PUZZLE_ANSWER_ZIPF`, calibrated per word-length
bucket) *and* have to be attested as an ordinary, non-proper-noun word in the
NLTK Brown Corpus (`_common_word_set` in `generator/wordlist.py`). zipf
scores alone let through abbreviations/jargon/name-as-word noise that happen
to be common in wordfreq's web-text-heavy source blend (e.g. "var", "reg",
"jin", or "ted"/"pam" leaking in from characters' names) - some of those
score as common as or higher than genuinely everyday words, so no zipf
threshold alone can filter them out. Brown-corpus attestation (with a
proper-noun guard on capitalized nouns) does.

The grid will never place two simple inflections of the same word in one
level (e.g. FLEA + FLEAS, NEED + NEEDS as separate grid answers) -
`word_stem`/`dedupe_inflections` in `generator/wordlist.py` strip common
suffixes (`-s`, `-es`, `-ed`, `-ing`) to group words before the answer
candidate pool is finalized, keeping the shorter/base form (the anchor
always wins its own group, since it must stay force-placed). This is
grid-only, not a legality rule - an inflection of a placed answer can still
show up as a bonus find (e.g. TAN placed + TANS as bonus is fine).

The minimum/maximum placed-word count per level is scaled per word length
(`TARGET_WORD_COUNT_RANGE_BY_LENGTH` in `generator/level_builder.py`), not
one flat range. A 3-letter wheel can only ever produce anagrams of itself as
grid words (no shorter subset exists to draw on - `grid_builder` requires
placed words to be >=3 letters), so most letter triples have at most one or
two valid anagram siblings; demanding 5+ words per level (fine for 5-6
letter rounds) made every 3-letter candidate fail silently until this was
scaled down.

Level IDs are scoped by `round_id`, not just theme+length
(`amazon_rainforest_r3_001`, not `amazon_rainforest_5_001`) - two rounds of
the same length for the same theme (the ladder's "two 5-letter rounds")
would otherwise collide and silently overwrite each other's level files.

Four themes each have a full 6-round ladder now (55 levels each, invisible
to the player as separate rounds - see "Navigation" above): `amazon_rainforest`
(`ladder_001`), `flowers` (`ladder_002`), `italy` (`ladder_003`), and
`ocean_reef` (`ladder_004`) - each 3-letter (5 levels, kept shorter since a
3-letter wheel's tiny 2-3-word grids get repetitive fast), 4-letter, two
5-letter, two 6-letter (10 levels each), in that order. None of these four
have a curated
`config/theme_word_pools/<theme>.json` yet (only general-dictionary words,
no theme-specific vocabulary) - still worth adding. 6 more themes are queued
in `content-tools/config/themes.json` (desert_dunes, japanese_garden,
mountain_peaks, autumn_forest, beach_paradise, farmers_market) needing the
same treatment.

Unsplash's search can return zero results for an over-specific multi-term
query even when each term individually has thousands of matches (e.g. "italy
tuscany venice canal" found nothing, "italy tuscany venice" did) -
`theme_images.py` retries with progressively shorter prefixes of the query
before giving up. Also, a photo-fetch failure of any kind no longer aborts
the whole generator run - it's decorative, and used to crash the process
*after* the actual puzzle content was already generated, losing it over an
unrelated image problem.

## Android (Capacitor)

`android/` is a real, working Capacitor project (added via `npx cap add
android`, gitignored per the earlier `.gitignore` entry - regenerate it
locally rather than expecting it to be checked in).

```bash
npm install
npx cap add android      # only if android/ doesn't already exist locally
npx cap sync android      # re-run after any web/ or capacitor.config.json change
cd android && ./gradlew.bat assembleDebug   # -> android/app/build/outputs/apk/debug/app-debug.apk
```

**Needs JDK 17** - the Android Gradle Plugin (AGP 8.x, what Capacitor 6
scaffolds) refuses to run on anything older and errors out immediately
naming the exact version it wants. Neither a system Java 8 install nor
Android Studio's own bundled JRE (which was Java 11, older than AGP wants,
on this machine) satisfy that - installed `Microsoft.OpenJDK.17` via
`winget` and pointed `JAVA_HOME` at it for the Gradle invocation (e.g.
`JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.20.101-hotspot"
./gradlew.bat assembleDebug` from bash). No `gradle.properties` override was
needed - the explicit `JAVA_HOME` env var was enough.

A debug build has been installed and verified running on a real connected
device this checkpoint (`adb install -r app-debug.apk`, confirmed as
`topResumedActivity` afterward - i.e. actually in the foreground, not
crashed back out). Touch input specifically hasn't been fully exercised
though - `adb shell input swipe` only does a straight 2-point gesture, and
every word in this content is 3+ letters (needs the full wheel), so a
proper continuous multi-node drag trace wasn't separately confirmed via
basic adb tooling. The wheel uses standard Pointer Events, the same code
path Playwright's mouse-drag testing exercised all session, so this is a
narrow, likely-fine gap, not a known problem.

**Real-device-only rendering bug**: every custom `<button>` in this app
(back-fab, bonus-word FAB, Continue, Reset progress) rendered as unstyled
native Android chrome - a default rounded-rect with a solid fill and
off-center content - on a real device, despite rendering perfectly correct
in desktop Chrome and Playwright the entire session. `appearance: none` /
`-webkit-appearance: none` did *not* fix it (confirmed - verified the fix
was actually in the built APK's bundled CSS, then still saw the native
rendering after a full uninstall/reinstall to rule out WebView caching).
Meanwhile plain `<div>`-based custom UI (`.theme-card`, `.card`) rendered
its CSS (border-radius, gradient overlays, everything) correctly on the
same device the whole time. The fix: stop using `<button>` for custom-styled
controls in this app entirely - use a `<div role="button" tabindex="0">`
with a click handler instead (see `web/js/screens/*.js` and `.back-fab`/
`.btn` in `styles.css`). If a future change reintroduces a real `<button>`
anywhere, re-verify it on a physical device before trusting how it looked
in desktop testing - this class of bug is invisible there.

Icons are inline SVG (`web/js/core/icons.js`), not text glyphs (`←` rendered
inconsistently/off-center across fonts) and not an icon font/CDN (this app
never fetches anything at runtime by design). Paths are from Google's
Material Icons, Apache 2.0, no attribution required.

## Next steps

1. Curate `config/theme_word_pools/<theme>.json` seed lists for the 4 themes
   that already have levels (amazon_rainforest, flowers, italy, ocean_reef -
   all generated from the general dictionary only so far), then generate the
   remaining 6 queued themes (desert_dunes, japanese_garden, mountain_peaks,
   autumn_forest, beach_paradise, farmers_market).
2. ~~Add the Capacitor Android wrapper and test on a real device~~ - mostly
   done this checkpoint (built, installed, and confirmed running in the
   foreground on a real connected device). Still needs actual touch-input
   verification (tap/drag on the wheel) - everything so far was mouse events
   via Playwright, not a real touchscreen.
3. ~~Run the generator with a real Unsplash key and confirm the bundled
   photo + attribution render~~ - done this checkpoint (4 themes now have
   real bundled photos + attribution, verified in-browser).
4. ~~Verify level-complete flow end-to-end~~ - done this checkpoint
   (level-complete overlay, round/level progression locking, and
   next-level continuation all verified in-browser).
