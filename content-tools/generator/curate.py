"""Scores and filters a batch of candidate levels, keeping the best N."""
from __future__ import annotations


def compactness_score(level: dict) -> float:
    """Lower grid area relative to letters placed = tighter, more solvable grid."""
    rows, cols = level["grid"]["rows"], level["grid"]["cols"]
    letters_placed = sum(len(w["text"]) for w in level["words"])
    area = rows * cols
    return letters_placed / area if area else 0


def word_set_signature(level: dict) -> frozenset[str]:
    return frozenset(w["text"] for w in level["words"])


def curate(levels: list[dict], keep: int) -> list[dict]:
    seen_signatures: set[frozenset[str]] = set()
    deduped = []
    for level in levels:
        sig = word_set_signature(level)
        if sig in seen_signatures:
            continue
        seen_signatures.add(sig)
        deduped.append(level)

    deduped.sort(key=compactness_score, reverse=True)
    return deduped[:keep]
