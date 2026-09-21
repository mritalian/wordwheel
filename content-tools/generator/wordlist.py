"""Dictionary + commonness lookups for level generation.

Legality is decided by ENABLE1 (public domain, ~172k words). Commonness is
decided by wordfreq's zipf_frequency, which is used to split words into two
tiers: common enough to be a crossword puzzle *answer*, vs merely real enough
to count as a *bonus* word when a player happens to trace it.
"""
from __future__ import annotations

import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

from wordfreq import zipf_frequency

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ENABLE1_PATH = DATA_DIR / "enable1.txt"

# Per-length-bucket zipf thresholds. Short words trend higher in zipf score
# naturally (there just aren't many 3-letter words at all, so commonish ones
# already stand out), so buckets are calibrated separately rather than using
# one global cutoff.
PUZZLE_ANSWER_ZIPF = {
    3: 3.6,
    4: 3.3,
    5: 3.0,
    6: 2.8,
}
DEFAULT_PUZZLE_ANSWER_ZIPF = 2.7
BONUS_WORD_ZIPF = 1.5

_WORD_RE = re.compile(r"^[a-z]+$")

# A small blocklist of slurs/profanity to exclude from both tiers regardless
# of how "common" wordfreq considers them. Kept short and generic on purpose;
# extend as needed.
BLOCKLIST = {
    "nigger", "nigga", "faggot", "fag", "cunt", "spic", "chink", "kike",
    "retard", "whore", "slut", "rape", "raped", "raping", "cock", "dick",
    "pussy", "shit", "shitty", "fuck", "fucker", "fucking", "asshole",
    "bastard", "bitch", "bitches",
}


class WordList:
    def __init__(self, enable1_path: Path = ENABLE1_PATH):
        self._all_words: set[str] = set()
        self._by_length: dict[int, set[str]] = defaultdict(set)
        self._by_letterset: dict[frozenset[str], list[str]] = defaultdict(list)
        self._load(enable1_path)

    def _load(self, path: Path) -> None:
        with open(path, encoding="utf-8") as f:
            for line in f:
                word = line.strip().lower()
                if not word or not _WORD_RE.match(word) or word in BLOCKLIST:
                    continue
                self._all_words.add(word)
                self._by_length[len(word)].add(word)

    def is_valid_word(self, word: str) -> bool:
        return word.lower() in self._all_words

    @lru_cache(maxsize=200_000)
    def commonness(self, word: str) -> float:
        return zipf_frequency(word.lower(), "en")

    def words_of_length(self, n: int) -> set[str]:
        return self._by_length.get(n, set())

    def puzzle_answer_threshold(self, length: int) -> float:
        return PUZZLE_ANSWER_ZIPF.get(length, DEFAULT_PUZZLE_ANSWER_ZIPF)

    def is_puzzle_answer_candidate(self, word: str) -> bool:
        return self.commonness(word) >= self.puzzle_answer_threshold(len(word))

    def is_bonus_candidate(self, word: str) -> bool:
        return self.commonness(word) >= BONUS_WORD_ZIPF

    def common_words_of_length(self, n: int) -> list[str]:
        threshold = self.puzzle_answer_threshold(n)
        return [w for w in self._by_length.get(n, set()) if self.commonness(w) >= threshold]

    def _letterset_index(self) -> dict[frozenset[str], list[str]]:
        # Deliberately no zipf/commonness filtering here - that call is
        # expensive per-word, so it's deferred to only the handful of
        # candidates that actually pass the cheap letter-subset check below.
        if not self._by_letterset:
            for word in self._all_words:
                if 3 <= len(word) <= 8:
                    self._by_letterset[frozenset(word)].append(word)
        return self._by_letterset

    def words_matching_letterset(self, available_counts: dict[str, int],
                                  require_bonus_tier: bool = True) -> list[str]:
        """All legal dictionary words spellable from the given letter multiset.

        This is the core "wheel -> playable words" lookup: given the exact
        tile counts available on the wheel, find every real word (subject to
        the bonus-commonness filter by default, to avoid true obscurities)
        that can be traced from those tiles.
        """
        available_letters = frozenset(available_counts.keys())
        index = self._letterset_index()
        results = []
        for letterset, words in index.items():
            if not letterset <= available_letters:
                continue
            for word in words:
                counts: dict[str, int] = defaultdict(int)
                for ch in word:
                    counts[ch] += 1
                if all(available_counts.get(ch, 0) >= n for ch, n in counts.items()):
                    if not require_bonus_tier or self.is_bonus_candidate(word):
                        results.append(word)
        return results
