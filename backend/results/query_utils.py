from django.db.models import Case, When, Value, IntegerField
from django.db.models import Sum, Q
from django.db.models.functions import Coalesce

# Base points by position
POINTS_CASE = Case(
    When(finish_position=1, then=Value(25)),
    When(finish_position=2, then=Value(18)),
    When(finish_position=3, then=Value(15)),
    When(finish_position=4, then=Value(12)),
    When(finish_position=5, then=Value(10)),
    When(finish_position=6, then=Value(8)),
    When(finish_position=7, then=Value(6)),
    When(finish_position=8, then=Value(4)),
    When(finish_position=9, then=Value(2)),
    When(finish_position=10, then=Value(1)),
    default=Value(0),
    output_field=IntegerField(),
)

# +1 for fastest lap (no top-10 restriction per your rule)
FASTEST_LAP_BONUS = Case(
    When(fastest_lap=True, then=Value(1)),
    default=Value(0),
    output_field=IntegerField(),
)

POINT_EXPR = POINTS_CASE + FASTEST_LAP_BONUS

def season_standings_queryset(season_id):
    """
    DriverSeason rows for the season, annotated with 'points'.
    """
    from entries.models import DriverSeason
    return (
        DriverSeason.objects
        .filter(season_id=season_id)
        .select_related("driver", "team")
        .annotate(
            points=Coalesce(
                Sum(POINT_EXPR, filter=Q(results__race__season_id=season_id)),
                0,
                output_field=IntegerField(),
            )
        )
        .order_by("-points", "driver__last_name", "driver__first_name")
    )