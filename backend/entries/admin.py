from django.contrib import admin
from .models import TeamSeason, DriverSeason

@admin.register(TeamSeason)
class TeamSeasonAdmin(admin.ModelAdmin):
    list_display = ("id", "season", "team", "display_name")
    list_filter = ("season", "team")
    search_fields = ("display_name", "team__team_name")

@admin.register(DriverSeason)
class DriverSeasonAdmin(admin.ModelAdmin):
    list_display = ("id", "season", "driver", "team_season", "car_number", "is_reserve")
    list_filter = ("season", "team_season__team", "is_reserve")
    search_fields = ("driver__first_name", "driver__last_name", "team_season__team__team_name")