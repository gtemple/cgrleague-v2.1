from django.contrib import admin
from .models import Team

@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("id", "team_name", "country", "founded")
    search_fields = ("team_name", "country")