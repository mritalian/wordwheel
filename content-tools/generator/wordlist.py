"""Dictionary + commonness lookups for level generation.

Legality is decided by ENABLE1 (public domain, ~172k words) for both tiers.
Commonness is decided differently per tier:

- *Bonus* words (found by accident, not placed in the grid) only need
  wordfreq's zipf_frequency above a low bar - obscurity there is a feature,
  a fun surprise, not a bug.
- *Puzzle answer* words (placed in the grid, the ones a player is expected
  to actually solve for) need to be recognizable, not just "technically a
  real word." wordfreq's zipf score alone can't tell those apart: its
  default corpus blend pulls from web/social text, which inflates
  abbreviations and jargon (e.g. "var", "reg", "jin" all score as common as
  or higher than genuinely everyday words like "humid" or "wager" - see
  generator design notes). So puzzle answers additionally require the word
  to be attested, as an ordinary word (not a capitalized proper noun), in
  the Brown Corpus - a small, hand-curated, editorially-published reference
  corpus. That naturally excludes internet-era slang/jargon/abbreviations
  and name-as-word leakage (e.g. "ted"/"pam" showing up only as characters'
  names) without needing per-length zipf threshold tuning to do it alone.
"""
from __future__ import annotations

import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import nltk
from wordfreq import zipf_frequency

_WORD_ONLY_RE = re.compile(r"^[a-z]+$")

_INFLECTION_SUFFIXES = ("ing", "ed", "es", "s")


def word_stem(word: str) -> str:
    """Crude inflection stem - strips a trailing plural/verb suffix so that
    e.g. "flea"/"fleas" or "need"/"needs" are recognized as the same base
    word. Not a real lemmatizer, just enough to stop a puzzle from placing
    (or bonus-listing) two forms of the same word."""
    w = word.lower()
    for suf in _INFLECTION_SUFFIXES:
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)]
    return w


def dedupe_inflections(words: list[str]) -> list[str]:
    """Keep one representative per inflection group (shortest/most-base form
    wins), so a candidate list never offers both e.g. NEED and NEEDS."""
    chosen: dict[str, str] = {}
    for w in words:
        stem = word_stem(w)
        current = chosen.get(stem)
        if current is None or (len(w), w) < (len(current), current):
            chosen[stem] = w
    return list(chosen.values())


@lru_cache(maxsize=1)
def _common_word_set() -> frozenset[str]:
    """Words attested as an ordinary (non-proper-noun) token in the Brown
    Corpus. Downloads the corpus on first use (cached locally by nltk after
    that, same as any other one-time generator setup step)."""
    nltk.download("brown", quiet=True)
    nltk.download("universal_tagset", quiet=True)
    from nltk.corpus import brown

    words: set[str] = set()
    for word, tag in brown.tagged_words(tagset="universal"):
        lowered = word.lower()
        if not _WORD_ONLY_RE.match(lowered):
            continue
        if tag == "NOUN" and word[:1].isupper():
            continue  # likely a proper noun (character/place name), not a common word
        words.add(lowered)
    return frozenset(words)

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
    # Ethnic/racial slurs - ENABLE1 is a Scrabble-legality list, not a
    # content filter, so it includes plenty of these as "technically legal"
    # short/common-looking words (e.g. "dago" turned up as a bonus-word
    # candidate before this entry was added).
    "dago", "dagos", "wop", "wops", "kraut", "krauts", "gook", "gooks",
    "coon", "coons", "wog", "wogs", "paki", "pakis", "honky", "honkey",
    "honkies", "squaw", "squaws", "redskin", "redskins", "negro", "negros",
    "negress", "injun", "injuns", "wetback", "wetbacks", "beaner", "beaners",
    "gyp", "gypped", "raghead", "ragheads", "towelhead", "towelheads",
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
        word = word.lower()
        if self.commonness(word) < self.puzzle_answer_threshold(len(word)):
            return False
        return word in _common_word_set()

    def is_bonus_candidate(self, word: str) -> bool:
        return self.commonness(word) >= BONUS_WORD_ZIPF

    def common_words_of_length(self, n: int) -> list[str]:
        return [w for w in self._by_length.get(n, set()) if self.is_puzzle_answer_candidate(w)]

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
