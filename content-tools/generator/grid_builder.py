"""Pure functions that pack a set of words into an interlocking crossword grid.

No file I/O, no globals - this is the part of the pipeline designed to be
reusable as-is behind a future backend endpoint.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field


@dataclass
class PlacedWord:
    word_id: str
    text: str
    row: int
    col: int
    orientation: str  # "horizontal" | "vertical"
    standalone: bool = False

    def cells(self) -> list[tuple[int, int]]:
        if self.orientation == "horizontal":
            return [(self.row, self.col + i) for i in range(len(self.text))]
        return [(self.row + i, self.col) for i in range(len(self.text))]


@dataclass
class GridResult:
    words: list[PlacedWord]
    rows: int
    cols: int


def _can_place(word: str, row: int, col: int, orientation: str,
                occupied: dict[tuple[int, int], str],
                cell_orientations: dict[tuple[int, int], set[str]],
                max_rows: int, max_cols: int) -> bool:
    cells = (
        [(row, col + i) for i in range(len(word))]
        if orientation == "horizontal"
        else [(row + i, col) for i in range(len(word))]
    )
    if any(r < 0 or c < 0 or r >= max_rows or c >= max_cols for r, c in cells):
        return False

    has_intersection = False
    for (r, c), ch in zip(cells, word):
        # A cell can carry at most one horizontal and one vertical word
        # through it. Sharing a cell with a word of the SAME orientation is
        # never a legal crossing - that's collinear overlap (e.g. "SIN" and
        # "SINK" both running horizontally through row 0), not an
        # intersection, and would make the grid ambiguous/unsolvable.
        if orientation in cell_orientations.get((r, c), ()):
            return False
        existing = occupied.get((r, c))
        if existing is not None:
            if existing != ch:
                return False
            has_intersection = True

    # Cells immediately before/after the word (in its own direction) must be
    # empty, so we don't accidentally extend an existing word.
    if orientation == "horizontal":
        before, after = (row, col - 1), (row, col + len(word))
    else:
        before, after = (row - 1, col), (row + len(word), col)
    if before in occupied or after in occupied:
        return False

    # Perpendicular neighbors of non-intersecting cells must be empty, to
    # avoid forming an unintended adjacent word.
    for (r, c), ch in zip(cells, word):
        if occupied.get((r, c)) == ch:
            continue  # this is a legitimate crossing cell
        if orientation == "horizontal":
            neighbors = [(r - 1, c), (r + 1, c)]
        else:
            neighbors = [(r, c - 1), (r, c + 1)]
        if any(n in occupied for n in neighbors):
            return False

    return has_intersection


def _find_placements(word: str, occupied: dict[tuple[int, int], str],
                      cell_orientations: dict[tuple[int, int], set[str]],
                      max_rows: int, max_cols: int) -> list[tuple[int, int, str]]:
    placements = []
    for (or_, oc), ch in occupied.items():
        for i, letter in enumerate(word):
            if letter != ch:
                continue
            # Try placing horizontally through this shared letter.
            placements.append((or_, oc - i, "horizontal"))
            # Try placing vertically through this shared letter.
            placements.append((or_ - i, oc, "vertical"))
    valid = []
    for row, col, orientation in placements:
        if _can_place(word, row, col, orientation, occupied, cell_orientations, max_rows, max_cols):
            valid.append((row, col, orientation))
    return valid


def _normalize(words: list[PlacedWord]) -> tuple[list[PlacedWord], int, int]:
    all_cells = [cell for w in words for cell in w.cells()]
    min_row = min(r for r, _ in all_cells)
    min_col = min(c for _, c in all_cells)
    for w in words:
        w.row -= min_row
        w.col -= min_col
    max_row = max(r for r, _ in [cell for w in words for cell in w.cells()])
    max_col = max(c for _, c in [cell for w in words for cell in w.cells()])
    return words, max_row + 1, max_col + 1


def build_interlocking_set(
    candidate_words: list[str],
    target_count: int,
    max_rows: int,
    max_cols: int,
    rng_seed: int,
    standalone_chance: float = 0.0,
    max_attempts: int = 200,
    required_word: str | None = None,
) -> GridResult | None:
    """Greedy + backtracking crossword packer.

    Picks a seed word, then repeatedly adds words that legally intersect the
    already-placed set, backtracking on dead ends, until `target_count`
    words are placed or attempts run out. If `required_word` is given, it is
    always used as the seed (and therefore always placed) instead of a
    random pick - used to guarantee the wheel's full-length anchor word
    always ends up in the grid.
    """
    rng = random.Random(rng_seed)
    pool = list({w.upper() for w in candidate_words if len(w) >= 3})
    if len(pool) < target_count:
        return None

    required = required_word.upper() if required_word else None
    if required and required not in pool:
        return None

    for attempt in range(max_attempts):
        rng.shuffle(pool)
        seed = required if required else pool[0]
        placed: list[PlacedWord] = [PlacedWord("w1", seed, 0, 0, "horizontal")]
        occupied: dict[tuple[int, int], str] = {
            cell: ch for cell, ch in zip(placed[0].cells(), seed)
        }
        cell_orientations: dict[tuple[int, int], set[str]] = {
            cell: {"horizontal"} for cell in placed[0].cells()
        }
        used = {seed}
        remaining = [w for w in pool if w not in used]

        stalled_rounds = 0
        while len(placed) < target_count and remaining and stalled_rounds < len(remaining) + 1:
            progressed = False
            for word in list(remaining):
                spots = _find_placements(word, occupied, cell_orientations, max_rows, max_cols)
                if not spots:
                    continue
                row, col, orientation = rng.choice(spots)
                word_id = f"w{len(placed) + 1}"
                new_word = PlacedWord(word_id, word, row, col, orientation)
                placed.append(new_word)
                for cell, ch in zip(new_word.cells(), word):
                    occupied[cell] = ch
                    cell_orientations.setdefault(cell, set()).add(orientation)
                used.add(word)
                remaining.remove(word)
                progressed = True
                if len(placed) >= target_count:
                    break
            if not progressed:
                stalled_rounds += 1
            else:
                stalled_rounds = 0

        if len(placed) >= min(target_count, 3):
            if rng.random() < standalone_chance:
                _try_add_standalone(placed, occupied, remaining, rng, max_rows, max_cols)
            normalized, rows, cols = _normalize(placed)
            return GridResult(words=normalized, rows=rows, cols=cols)

    return None


def _try_add_standalone(placed: list[PlacedWord], occupied: dict[tuple[int, int], str],
                         remaining: list[str], rng: random.Random,
                         max_rows: int, max_cols: int) -> None:
    """Place one extra word with no shared letters, offset below the cluster."""
    if not remaining:
        return
    max_row = max(r for w in placed for r, _ in w.cells())
    gap_row = max_row + 2
    for word in remaining:
        cells = [(gap_row, i) for i in range(len(word))]
        if all(0 <= c < max_cols for _, c in cells) and gap_row < max_rows:
            word_id = f"w{len(placed) + 1}"
            new_word = PlacedWord(word_id, word, gap_row, 0, "horizontal", standalone=True)
            placed.append(new_word)
            for cell, ch in zip(cells, word):
                occupied[cell] = ch
            return
