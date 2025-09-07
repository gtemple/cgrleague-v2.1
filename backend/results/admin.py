from django.contrib import admin
from .models import Race, RaceResult

@admin.register(Race)
class RaceAdmin(admin.ModelAdmin):
    list_display = ("season", "round", "track", "is_sprint", "laps")
    list_filter = ("season", "is_sprint", "track")
    search_fields = ("track__track_name",)
    ordering = ("season", "round", "is_sprint")

@admin.register(RaceResult)
class RaceResultAdmin(admin.ModelAdmin):
    list_display = (
        "race", "driver_season", "grid_position", "finish_position",
        "status", "fastest_lap", "pole_position", "dotd",
    )
    list_filter = ("race__season", "race__is_sprint", "status", "fastest_lap", "pole_position", "dotd")
    search_fields = (
        "driver_season__driver__first_name",
        "driver_season__driver__last_name",
        "race__track__track_name",
    )
