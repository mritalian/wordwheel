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
from .wordlist import WordList

GRID_SIZE_CAPS = {
    3: (6, 6),
    4: (7, 7),
    5: (8, 8),
    6: (9, 9),
}
DEFAULT_GRID_CAP = (9, 9)
TARGET_WORD_COUNT_RANGE = (5, 7)
STANDALONE_CHANCE = 0.12

# How many distinct wheel letters to aim for, given the round's target word
# length - a real Wordscapes-style wheel is usually the anchor word's length
# plus one or two extra letters, not a dozen+.
WHEEL_SIZE_RANGE = {
    3: (5, 6),
    4: (6, 7),
    5: (7, 8),
    6: (8, 9),
}

# Rough English letter frequency order, used to pick "natural" extra wheel
# letters rather than uniformly random ones.
LETTER_FREQUENCY_ORDER = "ETAOINSHRDLCUMWFGYPBVKJXQZ"


def _pick_wheel_letters(anchor_word: str, target_size: int, rng: random.Random) -> dict[str, int]:
    counts = Counter(anchor_word.lower())
    extra_needed = target_size - len(counts)
    if extra_needed > 0:
        available_extra = [ch for ch in LETTER_FREQUENCY_ORDER.lower() if ch not in counts]
        # Weight toward the front of the frequency order without being fully
        # deterministic: sample from the more-common half most of the time.
        weights = [1.0 / (i + 1) for i in range(len(available_extra))]
        chosen: set[str] = set()
        pool = list(zip(available_extra, weights))
        while len(chosen) < min(extra_needed, len(pool)):
            letters, letter_weights = zip(*[p for p in pool if p[0] not in chosen])
            pick = rng.choices(letters, weights=letter_weights, k=1)[0]
            chosen.add(pick)
        for letter in chosen:
            counts[letter] = 1
    return dict(counts)


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
    min_size, max_size = WHEEL_SIZE_RANGE.get(word_length, (7, 8))
    target_wheel_size = rng.randint(min_size, max_size)
    wheel_letters = _pick_wheel_letters(anchor, target_wheel_size, rng)

    # Every real, legal word spellable from this exact letter multiset.
    # Puzzle-tier ones are candidates for the grid; the bonus-tier superset
    # (still commonness-filtered, just looser) becomes the bonus word list.
    all_spellable = wordlist.words_matching_letterset(wheel_letters, require_bonus_tier=False)
    puzzle_candidates = [w.upper() for w in all_spellable if wordlist.is_puzzle_answer_candidate(w)]
    if anchor.upper() not in puzzle_candidates:
        puzzle_candidates.append(anchor.upper())

    if len(puzzle_candidates) < TARGET_WORD_COUNT_RANGE[0]:
        return None

    max_rows, max_cols = GRID_SIZE_CAPS.get(word_length, DEFAULT_GRID_CAP)
    target_count = min(TARGET_WORD_COUNT_RANGE[1], max(TARGET_WORD_COUNT_RANGE[0], len(puzzle_candidates)))

    grid: GridResult | None = build_interlocking_set(
        puzzle_candidates,
        target_count=target_count,
        max_rows=max_rows,
        max_cols=max_cols,
        rng_seed=rng_seed,
        standalone_chance=STANDALONE_CHANCE,
    )
    if grid is None or len(grid.words) < TARGET_WORD_COUNT_RANGE[0]:
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
