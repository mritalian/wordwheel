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
- **Theme photos**: Unsplash API, fetched by keyword, cached locally, with
  required photographer attribution.

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
content/generated/     curated output of the generator (levels/rounds), the
                        source of truth copied into web/assets/content/
content/candidates/    oversupply batch before curation (gitignored)
capacitor.config.json  webDir: "web" - Android wrapper config
```

## Running the web app

No build step - it's plain ES modules loaded directly by `index.html`.
`fetch()` of local JSON is blocked under `file://` in most browsers, so serve
it with any static file server:

```bash
cd web
python3 -m http.server 8080
# or: npx http-server web -p 8080
```

Then open `http://localhost:8080`. You should land on the ladder-select
screen; the one bundled round so far is "Amazon Rainforest" (5-letter, 10
levels). Click into a level, tap a wheel letter and drag across others to
trace a word - matches fill the crossword, real-but-unplaced words count as
bonus finds, invalid traces shake and reset.

**Status as of this checkpoint**: the client code has been written and
manually traced for correctness, and the content pipeline has been verified
with actual generated levels (integrity-checked: no grid conflicts, no
collinear word overlaps, every placed word spellable from its wheel) - but it
has **not yet been exercised in an actual browser**. That's the next thing to
do when picking this back up.

## Content generator

```bash
cd content-tools
pip install -r requirements.txt   # just wordfreq
python3 -m generator.cli \
  --theme amazon_rainforest --round-id amazon_rainforest_r1 \
  --length 5 --count 300 --keep 10
```

This generates `--count` candidate levels (oversupply), curates down to
`--keep`, and writes level JSON + a round JSON to `content/generated/` (see
`cli.py --help` for all options: `--theme-display-name`, `--unsplash-query`,
`--out`, `--seed`).

After generating, copy the results into the web app's bundled assets:

```bash
cp content/generated/levels/*.json web/assets/content/levels/
cp content/generated/rounds/*.json web/assets/content/rounds/
```

(This copy step is manual for now - worth scripting once there's more than
one theme in flight.)

**Algorithm, in short** (see docstrings in `content-tools/generator/` for
detail): pick a small letter multiset first (an "anchor" word + a couple of
extra letters), find every real dictionary word spellable from exactly that
multiset, then pack a subset of those into an interlocking grid via
backtracking. This is deliberately wheel-first, not words-first - building
words first and merging their letters was tried and discarded because it
produced 15+ letter wheels and thousands of bonus words, nothing like the
tight, authentic Wordscapes wheel. Rarity is controlled via `wordfreq` zipf
scores, calibrated per word-length bucket (see `PUZZLE_ANSWER_ZIPF` and
`BONUS_WORD_ZIPF` in `generator/wordlist.py`); legality is ENABLE1.

Only one theme (`amazon_rainforest`) has a curated word pool and generated
levels so far. `content-tools/config/themes.json` lists 9 more themes queued
up (flowers, italy, ocean_reef, desert_dunes, japanese_garden,
mountain_peaks, autumn_forest, beach_paradise, farmers_market) that still
need `config/theme_word_pools/<theme>.json` seed lists and a generator run.

## Android (Capacitor)

Not yet added to this checkout. Once ready:

```bash
npm install
npx cap add android
npx cap sync android
npx cap run android      # or: npx cap open android
```

## Next steps

1. **Open it in an actual browser and click through it** - this hasn't
   happened yet this checkpoint. Check: grid renders, mouse/touch drag on
   the wheel traces correctly, words fill with animation, bonus words are
   detected and listed, invalid traces shake and clear, level-complete and
   level-select flow works, progress persists across a reload.
2. Generate word pools + levels for the remaining 9 themes.
3. Add the Capacitor Android wrapper and test on a real device/emulator
   (touch input in particular - only mouse input has been exercised).
4. Wire up an actual Unsplash API key (`window.WORDGAME_UNSPLASH_ACCESS_KEY`,
   see `web/js/theme/ThemeLoader.js`) and confirm image fetch/cache/fallback
   and attribution display all work.
