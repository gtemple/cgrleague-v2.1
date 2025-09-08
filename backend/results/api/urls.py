from django.urls import path
from .views import SeasonStandingsView
from .views import ConstructorStandingsView
from .views import SeasonResultsMatrixView

urlpatterns = [
    path("seasons/<int:season_id>/standings/", SeasonStandingsView.as_view(), name="season-standings"),
    path("seasons/<int:season_id>/constructors/", ConstructorStandingsView.as_view(), name="constructor-standings"),
    path("seasons/<int:season_id>/results-matrix/", SeasonResultsMatrixView.as_view(), name="season-results-matrix"),
]

