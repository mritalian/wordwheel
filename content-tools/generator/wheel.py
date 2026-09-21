"""Derive the letter-wheel multiset from a set of placed words."""
from __future__ import annotations

from collections import Counter

from .grid_builder import PlacedWord


def derive_wheel_letters(placed_words: list[PlacedWord]) -> dict[str, int]:
    """For each distinct letter, take the max count needed by any single word.

    Not the sum across all words - the wheel only needs as many tiles of a
    letter as the single most letter-hungry word requires, since tiles are
    reused across separate trace attempts (just not within one trace beyond
    the tile count).
    """
    max_counts: dict[str, int] = {}
    for word in placed_words:
        counts = Counter(word.text)
        for letter, count in counts.items():
            max_counts[letter] = max(max_counts.get(letter, 0), count)
    return max_counts
