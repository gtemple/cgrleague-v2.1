# entries/admin.py
from django import forms
from django.contrib import admin
from .models import TeamSeason, DriverSeason

class TeamSeasonChoiceField(forms.ModelChoiceField):
    def label_from_instance(self, obj: TeamSeason) -> str:
        team_name = getattr(obj.team, "team_name", str(obj.team))
        season_game = getattr(obj.season, "game", "")
        disp = getattr(obj, "display_name", "") or ""
        # Example: S1 — F1 2024 • Red Bull (Primary)
        suffix = f" ({disp})" if disp else ""
        return f"S{obj.season_id} — {season_game} • {team_name}{suffix}"

class DriverSeasonForm(forms.ModelForm):
    team_season = TeamSeasonChoiceField(
        queryset=TeamSeason.objects.select_related("season", "team").order_by("season_id", "team__team_name"),
        required=False,
    )

    class Meta:
        model = DriverSeason
        fields = "__all__"

@admin.register(TeamSeason)
class TeamSeasonAdmin(admin.ModelAdmin):
    list_display = ("id", "season", "team", "display_name")
    list_filter = ("season", "team")
    search_fields = ("display_name", "team__team_name", "season__game")

    # nice: when using autocomplete_fields from other admins, this speeds things up
    ordering = ("season_id", "team__team_name")

@admin.register(DriverSeason)
class DriverSeasonAdmin(admin.ModelAdmin):
    form = DriverSeasonForm

    list_display = ("id", "season", "driver", "team_season", "car_number", "is_reserve")
    list_filter = ("season", "team_season__team", "is_reserve")
    search_fields = ("driver__first_name", "driver__last_name", "team_season__team__team_name", "season__game")

    # optional: enable autocompletes for large datasets
    autocomplete_fields = ("driver", "season", "team_season")

    # make list queries fast & reduce N+1
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related("season", "driver", "team_season__team", "team_season__season")
