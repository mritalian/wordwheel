"""Precompute the bonus-word list for a level at generation time."""
from __future__ import annotations

from .grid_builder import PlacedWord
from .wordlist import WordList


def find_bonus_words(
    wheel_letters: dict[str, int],
    placed_words: list[PlacedWord],
    wordlist: WordList,
) -> list[str]:
    placed_texts = {w.text.upper() for w in placed_words}
    lowercase_counts = {letter.lower(): count for letter, count in wheel_letters.items()}
    candidates = wordlist.words_matching_letterset(lowercase_counts)
    bonus = sorted({w.upper() for w in candidates} - placed_texts)
    return bonus
