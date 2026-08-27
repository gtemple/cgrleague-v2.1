from __future__ import annotations
from typing import Optional

POINTS_BY_POSITION = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
    6:  8, 7:  6, 8:  4, 9:  2, 10: 1,
}

# Sprints pay a shorter, flatter table down to eighth, as in F1. A sprint win is
# worth 8, not the 25 a Grand Prix pays.
SPRINT_POINTS_BY_POSITION = {
    1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
}


def table_for(is_sprint: bool) -> dict:
    return SPRINT_POINTS_BY_POSITION if is_sprint else POINTS_BY_POSITION


def points_for_position(pos: Optional[int], is_sprint: bool = False) -> int:
    """Base points for a finishing position (None, or outside the table -> 0)."""
    if pos is None:
        return 0
    return table_for(is_sprint).get(pos, 0)

def points_for_result(result: "RaceResult") -> int:
    """
    Total points for a RaceResult.
      - points by finish position, from the sprint or Grand Prix table
      - +1 if fastest lap and classified in the top 10
    """
    is_sprint = bool(result.race.is_sprint)
    base = points_for_position(result.finish_position, is_sprint)
    bonus = 1 if (result.fastest_lap and (result.finish_position or 99) <= 10) else 0

    return base + bonus
