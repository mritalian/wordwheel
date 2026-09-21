"""CLI entry point: generate + curate a batch of levels for one theme/length/round.

Usage:
  python3 -m generator.cli --theme amazon_rainforest --length 5 \
      --round-id amazon_rainforest_r1 --count 500 --keep 10 \
      --out ../content/generated

The I/O here (reading pool files, writing JSON) is the only part of this
pipeline that isn't a pure function - swapping this for a backend service
later only touches this module.
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

from .curate import curate
from .level_builder import build_level
from .wordlist import WordList

CONTENT_TOOLS_DIR = Path(__file__).resolve().parent.parent
THEME_POOL_DIR = CONTENT_TOOLS_DIR / "config" / "theme_word_pools"


def load_theme_pool(theme_id: str) -> list[str]:
    path = THEME_POOL_DIR / f"{theme_id}.json"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [w.upper() for w in data.get("words", [])]


def candidate_pool(theme_id: str, length: int, wordlist: WordList) -> list[str]:
    theme_words = [w for w in load_theme_pool(theme_id) if len(w) == length]
    general_words = [w.upper() for w in wordlist.common_words_of_length(length)]
    # Theme words first (order preserved for readability), then general
    # filler so a level always has enough candidates to interlock, even if
    # the theme's own pool is thin at this length.
    pool = list(dict.fromkeys(theme_words + general_words))
    return pool


POOL_SAMPLE_SIZE = 80


def generate_batch(theme_id: str, round_id: str, length: int, count: int,
                    wordlist: WordList, seed_start: int = 0) -> list[dict]:
    full_pool = candidate_pool(theme_id, length, wordlist)
    levels = []
    for i in range(count):
        seed = seed_start + i
        # Sample a bounded subset per level attempt - the backtracking search
        # in grid_builder is combinatorial in pool size, and a few dozen
        # candidate words already give plenty of variety per level.
        rng = random.Random(seed)
        sample = full_pool if len(full_pool) <= POOL_SAMPLE_SIZE else rng.sample(full_pool, POOL_SAMPLE_SIZE)
        level_id = f"{theme_id}_{length}_{i + 1:04d}"
        level = build_level(
            level_id=level_id,
            theme_id=theme_id,
            round_id=round_id,
            word_length=length,
            candidate_words=sample,
            wordlist=wordlist,
            rng_seed=seed,
        )
        if level:
            levels.append(level)
    return levels


def write_levels(levels: list[dict], out_dir: Path) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for i, level in enumerate(levels, start=1):
        # Re-number to a stable, sequential id within the round.
        level["levelId"] = f"{level['themeId']}_{level['wordLengthBucket']}_{i:03d}"
        path = out_dir / f"{level['levelId']}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(level, f, indent=2)
        written.append(level["levelId"])
    return written


def write_round(round_id: str, theme_id: str, theme_display_name: str, length: int,
                 unsplash_query: str, level_ids: list[str], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    round_data = {
        "roundId": round_id,
        "themeId": theme_id,
        "themeDisplayName": theme_display_name,
        "wordLengthBucket": length,
        "unsplashQuery": unsplash_query,
        "levelIds": level_ids,
    }
    with open(out_dir / f"{round_id}.json", "w", encoding="utf-8") as f:
        json.dump(round_data, f, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a batch of levels for one round.")
    parser.add_argument("--theme", required=True)
    parser.add_argument("--theme-display-name", default=None)
    parser.add_argument("--round-id", required=True)
    parser.add_argument("--unsplash-query", default=None)
    parser.add_argument("--length", type=int, required=True, choices=[3, 4, 5, 6])
    parser.add_argument("--count", type=int, default=500, help="oversupply candidates to generate")
    parser.add_argument("--keep", type=int, default=10, help="final levels to keep after curation")
    parser.add_argument("--out", type=Path, default=CONTENT_TOOLS_DIR.parent / "content" / "generated")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    wordlist = WordList()
    candidates = generate_batch(args.theme, args.round_id, args.length, args.count, wordlist, args.seed)
    print(f"Generated {len(candidates)}/{args.count} valid candidate levels.")

    kept = curate(candidates, args.keep)
    print(f"Kept {len(kept)} after curation.")

    level_ids = write_levels(kept, args.out / "levels")
    write_round(
        round_id=args.round_id,
        theme_id=args.theme,
        theme_display_name=args.theme_display_name or args.theme.replace("_", " ").title(),
        length=args.length,
        unsplash_query=args.unsplash_query or args.theme.replace("_", " "),
        level_ids=level_ids,
        out_dir=args.out / "rounds",
    )
    print(f"Wrote {len(level_ids)} levels and round '{args.round_id}' to {args.out}")


if __name__ == "__main__":
    main()
