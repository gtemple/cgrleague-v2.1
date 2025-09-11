from django.urls import path
from .views import SeasonStandingsView
from .views import ConstructorStandingsView
from .views import SeasonResultsMatrixView
from .views import SeasonLastRaceView
from .views import NextRaceTeaserView

urlpatterns = [
    path("seasons/<int:season_id>/standings/", SeasonStandingsView.as_view(), name="season-standings"),
    path("seasons/<int:season_id>/constructors/", ConstructorStandingsView.as_view(), name="constructor-standings"),
    path("seasons/<int:season_id>/results-matrix/", SeasonResultsMatrixView.as_view(), name="season-results-matrix"),
    path("seasons/<int:season_id>/last-race/", SeasonLastRaceView.as_view(), name="season-last-race"),
    path("teasers/next-race/", NextRaceTeaserView.as_view(), name="next_race_teaser"),
]

