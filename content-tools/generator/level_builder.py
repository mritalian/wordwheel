"""Orchestrates wheel selection + grid_builder + bonus_words into one level.

Wheel-first design (matches how Wordscapes-style games actually feel): pick
one small letter multiset first, find every real word spellable from it, then
pack a subset of those into an interlocking grid. Building words-first and
merging their letters (the earlier approach) makes the wheel balloon to a
dozen-plus letters and the bonus list explode to thousands of words - nothing
like the tight, satisfying wheel this game needs.
"""
from __future__ import annotations

import random
from collections import Counter

from .bonus_words import find_bonus_words
from .grid_builder import GridResult, build_interlocking_set
from .wheel import derive_wheel_letters
from .wordlist import WordList, dedupe_inflections, word_stem

GRID_SIZE_CAPS = {
    3: (6, 6),
    4: (7, 7),
    5: (8, 8),
    6: (9, 9),
}
DEFAULT_GRID_CAP = (9, 9)

# A word placed in the grid must be >=3 letters (grid_builder's own floor),
# and every placed word is a subset of the wheel's exact letter multiset. For
# a 3-letter wheel that means the ONLY possible grid words are anagrams of
# the anchor itself (there's no shorter subset to draw on) - most letter
# triples have at most a couple of valid anagram siblings, so demanding 5+
# words (fine for 5-6 letter rounds, where plenty of shorter subset words
# exist) is essentially unsatisfiable and silently drops every 3-letter
# candidate. Scale the target down for short rounds instead.
TARGET_WORD_COUNT_RANGE_BY_LENGTH = {
    3: (2, 4),
    4: (3, 6),
    5: (5, 7),
    6: (5, 8),
}
DEFAULT_TARGET_WORD_COUNT_RANGE = (5, 7)
STANDALONE_CHANCE = 0.12


def build_level(
    level_id: str,
    theme_id: str,
    round_id: str,
    word_length: int,
    candidate_words: list[str],
    wordlist: WordList,
    rng_seed: int,
) -> dict | None:
    rng = random.Random(rng_seed)
    if not candidate_words:
        return None

    anchor = rng.choice(candidate_words).lower()
    # The wheel is exactly the anchor word's own letters (counting
    # duplicates) - no extra "flavor" tiles. That guarantees the anchor
    # itself is a full-wheel word, and every other placed/bonus word is a
    # true subset of the same tiles, matching how Wordscapes-style wheels
    # actually work (one word uses every tile, shorter ones use a subset).
    wheel_letters = dict(Counter(anchor))

    # Every real, legal word spellable from this exact letter multiset.
    # Puzzle-tier ones are candidates for the grid; the bonus-tier superset
    # (still commonness-filtered, just looser) becomes the bonus word list.
    all_spellable = wordlist.words_matching_letterset(wheel_letters, require_bonus_tier=False)
    puzzle_candidates = [w.upper() for w in all_spellable if wordlist.is_puzzle_answer_candidate(w)]
    if anchor.upper() not in puzzle_candidates:
        puzzle_candidates.append(anchor.upper())

    # No two candidates that are just inflections of each other (e.g. FLEA
    # + FLEAS, NEED + NEEDS) - the anchor always wins its own group since it
    # must survive to be force-placed below.
    puzzle_candidates = dedupe_inflections(puzzle_candidates)
    anchor_upper = anchor.upper()
    if anchor_upper not in puzzle_candidates:
        anchor_stem = word_stem(anchor)
        puzzle_candidates = [w for w in puzzle_candidates if word_stem(w) != anchor_stem]
        puzzle_candidates.append(anchor_upper)

    target_word_count_range = TARGET_WORD_COUNT_RANGE_BY_LENGTH.get(word_length, DEFAULT_TARGET_WORD_COUNT_RANGE)
    if len(puzzle_candidates) < target_word_count_range[0]:
        return None

    max_rows, max_cols = GRID_SIZE_CAPS.get(word_length, DEFAULT_GRID_CAP)
    target_count = min(target_word_count_range[1], max(target_word_count_range[0], len(puzzle_candidates)))

    grid: GridResult | None = build_interlocking_set(
        puzzle_candidates,
        target_count=target_count,
        max_rows=max_rows,
        max_cols=max_cols,
        rng_seed=rng_seed,
        standalone_chance=STANDALONE_CHANCE,
        required_word=anchor.upper(),
    )
    if grid is None or len(grid.words) < target_word_count_range[0]:
        return None

    # The wheel must supply exactly enough tiles for whatever the grid ended
    # up needing (a word might need a letter twice even if the wheel pick
    # above only allotted one tile) - reconcile by taking the max of the two.
    grid_wheel_needs = derive_wheel_letters(grid.words)
    final_wheel = {
        letter: max(wheel_letters.get(letter.lower(), 0), count)
        for letter, count in grid_wheel_needs.items()
    }

    bonus = find_bonus_words(final_wheel, grid.words, wordlist)

    return {
        "levelId": level_id,
        "themeId": theme_id,
        "roundId": round_id,
        "wordLengthBucket": word_length,
        "grid": {"rows": grid.rows, "cols": grid.cols},
        "words": [
            {
                "wordId": w.word_id,
                "text": w.text,
                "row": w.row,
                "col": w.col,
                "orientation": w.orientation,
                "cells": [{"row": r, "col": c} for r, c in w.cells()],
                "standalone": w.standalone,
            }
            for w in grid.words
        ],
        "wheelLetters": [
            {"letter": letter.upper(), "count": count} for letter, count in sorted(final_wheel.items())
        ],
        "bonusWords": bonus,
    }
