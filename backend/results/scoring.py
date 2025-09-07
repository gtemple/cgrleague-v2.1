from __future__ import annotations
from typing import Optional

POINTS_BY_POSITION = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
    6:  8, 7:  6, 8:  4, 9:  2, 10: 1,
}

def points_for_position(pos: Optional[int]) -> int:
    """Return base points for a finishing position (None or >10 -> 0)."""
    return POINTS_BY_POSITION.get(pos, 0) if pos is not None else 0

def points_for_result(result: "RaceResult") -> int:
    """
    Compute total points for a RaceResult.
    Rules you gave:
      - points by finish position (1..10)
      - +1 if fastest lap (no top-10 restriction specified)
    """
    base = points_for_position(result.finish_position)
    bonus = 1 if (result.fastest_lap and (result.finish_position or 99) <= 10) else 0

    return base + bonus
