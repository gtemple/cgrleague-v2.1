from typing import Any, Dict, Optional
from django.db.models import Case, When, Value, IntegerField, Q

# Shared points table (Finishing position → points)
PLACE_POINTS = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
    6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
}

def points_case(prefix: str = "results__") -> Case:
    """
    Build a per-row points CASE using PLACE_POINTS for annotations like:
      .annotate(base_points=Coalesce(Sum(points_case()), 0))
    prefix: relation prefix to 'finish_position' (e.g., 'results__' or '')
    """
    field = f"{prefix}finish_position"
    whens = [When(**{field: pos}, then=Value(pts)) for pos, pts in PLACE_POINTS.items()]
    return Case(*whens, default=Value(0), output_field=IntegerField())

def fl_bonus_case(prefix: str = "results__") -> Case:
    """
    +1 if fastest lap and classified in the points (<=10).
    Guards against NULL finish_position.
    prefix: relation prefix for related fields.
    """
    return Case(
        When(
            Q(**{f"{prefix}fastest_lap": True}) &
            Q(**{f"{prefix}finish_position__isnull": False}) &
            Q(**{f"{prefix}finish_position__lte": 10}),
            then=Value(1),
        ),
        default=Value(0),
        output_field=IntegerField(),
    )

# ---------- small serializer helpers ----------

def initials_for(driver) -> str:
    first = (getattr(driver, "first_name", "") or "").strip()
    last  = (getattr(driver, "last_name", "") or "").strip()
    if first or last:
        return (first[:1] + last[:1]).upper()
    name = (getattr(driver, "name", "") or "").strip()
    return name[:2].upper() if name else ""

def serialize_driver(drv) -> Dict[str, Any]:
    return {
        "id": drv.id,
        "first_name": getattr(drv, "first_name", "") or "",
        "last_name": getattr(drv, "last_name", "") or "",
        "display_name": (
            f"{getattr(drv, 'first_name', '') or ''} {getattr(drv, 'last_name', '') or ''}"
        ).strip() or getattr(drv, "name", ""),
        "profile_image": getattr(drv, "profile_image", None),
        "initials": initials_for(drv),
    }

def serialize_team(team_obj) -> Dict[str, Any]:
    return {
        "id": getattr(team_obj, "id", None),
        "name": getattr(team_obj, "team_name", "") if team_obj else "",
        "logo_image": getattr(team_obj, "team_img", None) if team_obj else None,
    }

def serialize_track(t) -> Dict[str, Any]:
    return {
        "id": t.id if t else None,
        "name": getattr(t, "name", "") if t else "",
        "city": getattr(t, "city", "") if t else "",
        "country": getattr(t, "country", "") if t else "",
        "image": getattr(t, "img", None) if t else None,
    }

def serialize_race_basic(r) -> Dict[str, Any]:
    return {
        "id": r.id,
        "round": r.round,
        "is_sprint": r.is_sprint,
        "track": serialize_track(r.track),
    }
