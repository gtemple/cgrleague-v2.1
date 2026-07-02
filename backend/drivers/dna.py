"""
Driver DNA — a computed 5-trait profile (Pace / Qualifying / Racecraft /
Consistency / Reliability) shown on the driver detail page.

Design notes (see also CLAUDE.md "Data caveats"):

Each trait is a **percentile rank** of the driver against the established grid
(drivers with >= POOL_MIN career races), not an absolute score. Percentile
normalization is deliberate: it guarantees the traits spread across the full
0-100 range and is robust to the league's uneven stat tracking. It means the
profile is comparative ("where you rank on the grid"), so the grid's best
driver on an axis is ~100 and the worst ~0.

Only reliably-tracked stats feed the traits:
  * avg finish, DNFs, fastest laps, DOTD, top-10 finishes  — tracked every season
  * poles                                                   — only S3+ (see below)
Deliberately NOT used (tracked too late to be career-fair):
  * cleanest-driver / most-overtakes  — only from S7
  * grid position / positions-gained  — only from S7

Poles: seasons before poles were recorded are excluded from BOTH the pole count
and its denominator, so a driver isn't punished for racing in an era when poles
weren't tracked. Pole-tracked seasons are derived from the data at runtime.

Trait definitions (higher raw = better; then percentile-ranked vs the pool):
  * Pace        = -avg_finish            (where you finish; the overall level)
  * Qualifying  = poles / pole_races     (one-lap pace)
  * Racecraft   = (dotd + 0.5*fl) / races (standout / comeback drives; in this
                  league DOTD rewards fighting through the field, so this axis
                  captures flair and is intentionally low for drivers who simply
                  win from the front)
  * Consistency = top10 / races          (banking points every weekend)
  * Reliability = 1 - dnf / races        (brings it home / stays out of trouble;
                  in this league DNFs are almost all crashes, so this reads as
                  incident-avoidance)
"""
from typing import Any, Dict, List, Optional

from django.core.cache import cache
from django.db.models import Avg, Count, Q

from results.cache import CACHE_TTL, key_driver_dna
from results.models import RaceResult

POOL_MIN_RACES = 10  # reference population for percentile boundaries

TRAIT_ORDER = ["pace", "qualifying", "racecraft", "consistency", "reliability"]
TRAIT_LABEL = {
    "pace": "Pace",
    "qualifying": "Qualifying",
    "racecraft": "Racecraft",
    "consistency": "Consistency",
    "reliability": "Reliability",
}
ARCHETYPE = {
    "pace": "Pace Setter",
    "qualifying": "Qualifier",
    "racecraft": "Entertainer",
    "consistency": "Metronome",
    "reliability": "Ever-Present",
}


def _pole_tracked_season_ids() -> List[int]:
    """Seasons with at least one recorded pole (poles were only tracked from S3)."""
    return list(
        RaceResult.objects.filter(pole_position=True)
        .values_list("race__season_id", flat=True)
        .distinct()
    )


def _raw_metrics() -> Dict[int, Dict[str, Any]]:
    """One grouped pass over RaceResult → per-driver raw metric inputs."""
    pole_seasons = _pole_tracked_season_ids()
    rows = (
        RaceResult.objects
        .values("driver_season__driver_id")
        .annotate(
            races=Count("id"),
            dnf=Count("id", filter=~Q(status="FIN")),
            avg_finish=Avg("finish_position"),  # NULLs ignored
            fl=Count("id", filter=Q(fastest_lap=True)),
            dotd=Count("id", filter=Q(dotd=True)),
            top10=Count("id", filter=Q(finish_position__lte=10, finish_position__isnull=False)),
            poles=Count("id", filter=Q(pole_position=True)),
            pole_races=Count("id", filter=Q(race__season_id__in=pole_seasons)),
        )
    )

    out: Dict[int, Dict[str, Any]] = {}
    for r in rows:
        races = r["races"] or 0
        if races == 0:
            continue
        did = r["driver_season__driver_id"]
        avg_finish = float(r["avg_finish"]) if r["avg_finish"] is not None else 20.0
        pole_races = r["pole_races"] or 0
        out[did] = {
            "races": races,
            # raw trait inputs — higher is better
            "pace": -avg_finish,
            "qualifying": (r["poles"] / pole_races) if pole_races > 0 else None,
            "racecraft": (r["dotd"] + 0.5 * r["fl"]) / races,
            "consistency": r["top10"] / races,
            "reliability": 1 - (r["dnf"] / races),
        }
    return out


def compute_dna_map() -> Dict[int, Dict[str, Any]]:
    """
    {driver_id: {"traits": [{key,label,value}], "archetype": str}} for every
    driver with >= 1 race. Percentile boundaries come from the established pool
    (>= POOL_MIN_RACES); rookies are still ranked against that pool.
    """
    metrics = _raw_metrics()
    pool = [m for m in metrics.values() if m["races"] >= POOL_MIN_RACES]

    # reference distributions per trait, plus each pool member's pace for tiebreaks
    ref = {k: [(m[k], m["pace"]) for m in pool if m[k] is not None] for k in TRAIT_ORDER}

    def pct(value: Optional[float], key: str, pace_tb: float) -> Optional[int]:
        pairs = ref[key]
        if value is None or len(pairs) < 2:
            return None
        beat = sum(1 for (v, p) in pairs if v < value or (v == value and p < pace_tb))
        return round(beat / (len(pairs) - 1) * 100)

    result: Dict[int, Dict[str, Any]] = {}
    for did, m in metrics.items():
        vals: Dict[str, int] = {}
        for k in TRAIT_ORDER:
            p = pct(m[k], k, m["pace"])
            if p is None:
                # only qualifying can be None (no pole-tracked seasons raced);
                # fall back to the driver's pace percentile as a proxy
                p = pct(m["pace"], "pace", m["pace"]) or 2
            vals[k] = max(2, min(100, p))

        mean = sum(vals.values()) / len(vals)
        top_key = max(vals, key=lambda k: vals[k] - mean)
        top_dev = vals[top_key] - mean
        archetype = ARCHETYPE[top_key] if (top_dev > 12 and vals[top_key] >= 55) else "All-Rounder"

        result[did] = {
            "traits": [{"key": k, "label": TRAIT_LABEL[k], "value": vals[k]} for k in TRAIT_ORDER],
            "archetype": archetype,
        }
    return result


def get_dna_map() -> Dict[int, Dict[str, Any]]:
    """Cached wrapper. Invalidated wholesale on any RaceResult change."""
    ck = key_driver_dna()
    cached = cache.get(ck)
    if cached is not None:
        return cached
    data = compute_dna_map()
    cache.set(ck, data, timeout=CACHE_TTL)
    return data
