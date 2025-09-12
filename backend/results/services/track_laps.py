# results/services/track_laps.py
from typing import Optional, Dict
from django.db import transaction
from results.models import Race, RaceResult

def set_track_laps(
    track_id: int,
    laps: int,
    *,
    season_id: Optional[int] = None,
    sprint_laps: int = 5,
    only_empty: bool = False,
    dry_run: bool = False,
) -> Dict[str, int]:
    """
    Set laps_completed for ALL RaceResult rows belonging to races at the given track.
    - Non-sprint races => laps
    - Sprint races     => sprint_laps (default 5)

    Args:
      track_id: Track primary key
      laps: number of laps for non-sprint races
      season_id: if provided, limits to that season only
      sprint_laps: override sprint lap count (default 5)
      only_empty: if True, only update rows where laps_completed is NULL or 0
      dry_run: if True, do not persist changes; return counts only

    Returns:
      dict with counts of updated results.
    """
    race_filter = {"track_id": track_id}
    if season_id is not None:
        race_filter["season_id"] = season_id

    non_sprint_qs = RaceResult.objects.filter(race__is_sprint=False, race__in=Race.objects.filter(**race_filter))
    sprint_qs     = RaceResult.objects.filter(race__is_sprint=True,  race__in=Race.objects.filter(**race_filter))

    if only_empty:
        non_sprint_qs = non_sprint_qs.filter(laps_completed__isnull=True) | non_sprint_qs.filter(laps_completed=0)
        sprint_qs     = sprint_qs.filter(laps_completed__isnull=True) | sprint_qs.filter(laps_completed=0)

    ns_count = non_sprint_qs.count()
    sp_count = sprint_qs.count()

    if dry_run:
        return {"non_sprint_to_update": ns_count, "sprint_to_update": sp_count, "updated": 0}

    with transaction.atomic():
        updated_ns = non_sprint_qs.update(laps_completed=laps)
        updated_sp = sprint_qs.update(laps_completed=sprint_laps)

    return {"non_sprint_updated": updated_ns, "sprint_updated": updated_sp, "updated": updated_ns + updated_sp}
