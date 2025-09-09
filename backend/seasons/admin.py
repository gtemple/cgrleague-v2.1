# seasons/admin.py
from django.contrib import admin
from django.db.models import Count
from .models import Season

# Optional inline to see/edit races in a season
try:
    from results.models import Race

    class RaceInline(admin.TabularInline):
        model = Race
        extra = 0
        fields = ("round", "is_sprint", "track", "laps", "started_at")
        ordering = ("round", "is_sprint")
        show_change_link = True
except Exception:  # results app might not be ready during early migrations
    RaceInline = None


@admin.register(Season)
class SeasonAdmin(admin.ModelAdmin):
    list_display = ("id", "game", "races_count", "drivers_count")
    list_display_links = ("id", "game")
    search_fields = ("game",)
    list_filter = ("game",)
    ordering = ("id",)
    actions = ["export_csv"]

    if RaceInline:
        inlines = [RaceInline]

    def get_queryset(self, request):
        """
        Annotate counts so list_display doesn’t N+1.
        - 'races' comes from Race.season.related_name="races"
        - 'driverseason' is the default related query name for entries.DriverSeason(season=...)
        """
        qs = super().get_queryset(request)
        qs = qs.annotate(_races_count=Count("races", distinct=True))

        # DriverSeason is optional: count if the app/model is present
        try:
            from entries.models import DriverSeason  # noqa: F401
            qs = qs.annotate(_drivers_count=Count("driverseason", distinct=True))
        except Exception:
            pass

        return qs

    @admin.display(description="Races")
    def races_count(self, obj) -> int:
        return getattr(obj, "_races_count", 0)

    @admin.display(description="Drivers")
    def drivers_count(self, obj) -> int:
        return getattr(obj, "_drivers_count", 0)

    def export_csv(self, request, queryset):
        """
        Simple CSV export with id, game, races, drivers.
        """
        import csv
        from django.http import HttpResponse

        # Make sure counts are present on the queryset
        qs = self.get_queryset(request).filter(pk__in=queryset.values("pk"))

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = "attachment; filename=seasons.csv"
        writer = csv.writer(response)
        writer.writerow(["id", "game", "races", "drivers"])
        for s in qs:
            writer.writerow([s.id, s.game, getattr(s, "_races_count", 0), getattr(s, "_drivers_count", 0)])
        return response

    export_csv.short_description = "Export selected seasons to CSV"