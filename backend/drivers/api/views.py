# drivers/api/views.py
from typing import Any, Dict
from django.db.models import Count, Sum, Avg, Case, When, IntegerField
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from drivers.models import Driver
from results.models import RaceResult
# Reuse your existing points helpers (same ones used in standings)
from results.api.views.utils import points_case, fl_bonus_case


def serialize_driver(d: Driver) -> Dict[str, Any]:
    """Consistent driver payload."""
    first = getattr(d, "first_name", "") or ""
    last  = getattr(d, "last_name", "") or ""
    display = (f"{first} {last}").strip() or getattr(d, "name", "") or f"Driver {d.id}"
    return {
        "id": d.id,
        "first_name": first,
        "last_name": last,
        "display_name": display,
        "profile_image": getattr(d, "profile_image", None),
        # add more fields if you store them (nationality, number, etc.)
    }


class DriversListView(APIView):
    """
    GET /api/drivers/?q=<search>
    Returns a lightweight, alphabetized list for dropdowns/filters.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        q = (request.GET.get("q") or "").strip()

        qs = Driver.objects.all()
        if q:
            qs = qs.filter(
                # simple search on first/last/display
                # (add .name if you keep a single-field name)
                # OR conditions via icontains
                # .filter(Q(... ) | Q(...)) if you prefer
                first_name__icontains=q
            ) | Driver.objects.filter(last_name__icontains=q)

        qs = qs.order_by("last_name", "first_name", "id")

        data = [serialize_driver(d) for d in qs]
        return Response(data)


class DriverDetailView(APIView):
    """
    GET /api/drivers/<driver_id>/
    Returns full driver info + career aggregates across all RaceResults.
    """
    permission_classes = [AllowAny]

    def get(self, request, driver_id: int, *args, **kwargs):
        driver = get_object_or_404(Driver, pk=driver_id)

        rr_qs = RaceResult.objects.filter(driver_season__driver_id=driver_id)

        # Base points from finish position + FL bonus as you use elsewhere
        base_expr = points_case(prefix="")         # uses RaceResult.finish_position
        fl_expr   = fl_bonus_case(prefix="")       # uses RaceResult.fastest_lap (+ classification rule you encoded)

        agg = rr_qs.aggregate(
            base_points=Coalesce(Sum(base_expr), 0),
            fl_bonus_points=Coalesce(Sum(fl_expr), 0),

            total_laps=Coalesce(Sum("laps_completed"), 0),

            # result counts (Case→Count pattern)
            wins=Count(Case(When(finish_position=1, then=1), output_field=IntegerField())),
            podiums=Count(Case(
                When(finish_position__isnull=False, finish_position__lte=3, then=1),
                output_field=IntegerField(),
            )),
            dnfs=Count(Case(When(status="DNF", then=1), output_field=IntegerField())),
            fastest_laps=Count(Case(When(fastest_lap=True, then=1), output_field=IntegerField())),
            poles=Count(Case(When(pole_position=True, then=1), output_field=IntegerField())),
            dotds=Count(Case(When(dotd=True, then=1), output_field=IntegerField())),
            cleanest_awards=Count(Case(When(cleanest_driver=True, then=1), output_field=IntegerField())),
            most_overtakes_awards=Count(Case(When(most_overtakes=True, then=1), output_field=IntegerField())),

            races_completed=Count(Case(When(status="FIN", then=1), output_field=IntegerField())),
            races_count=Count("id"),

            # average finish position across classified results (NULL ignored)
            avg_finish=Avg("finish_position"),
        )

        total_points = int(agg["base_points"]) + int(agg["fl_bonus_points"])

        payload = {
            "driver": serialize_driver(driver),
            "totals": {
                "points": total_points,
                "points_breakdown": {
                    "base": int(agg["base_points"]),
                    "fastest_lap_bonus": int(agg["fl_bonus_points"]),
                },
                "laps": int(agg["total_laps"] or 0),
                "wins": int(agg["wins"] or 0),
                "podiums": int(agg["podiums"] or 0),
                "dnfs": int(agg["dnfs"] or 0),
                "fastest_laps": int(agg["fastest_laps"] or 0),
                "poles": int(agg["poles"] or 0),
                "dotds": int(agg["dotds"] or 0),
                "cleanest_awards": int(agg["cleanest_awards"] or 0),
                "most_overtakes_awards": int(agg["most_overtakes_awards"] or 0),
                "races_completed": int(agg["races_completed"] or 0),
                "races": int(agg["races_count"] or 0),
                "avg_finish": (float(agg["avg_finish"]) if agg["avg_finish"] is not None else None),
            },
        }
        return Response(payload)
