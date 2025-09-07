from django.urls import path
from .views import SeasonStandingsView

urlpatterns = [
    path("seasons/<int:season_id>/standings/", SeasonStandingsView.as_view(), name="season-standings"),
]
