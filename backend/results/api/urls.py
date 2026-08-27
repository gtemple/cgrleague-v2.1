from django.urls import path
from .views import SeasonStandingsView
from .views import ConstructorStandingsView
from .views import SeasonResultsMatrixView
from .views import SeasonLastRaceView
from .views import NextRaceTeaserView, HistoryTeaserView
from .views import RaceDetailView
from .views import HallOfFameView
from .views import HeadToHeadMatrixView
from .views import RivalryView
from .views.admin import BulkUpsertResultsView

urlpatterns = [
    path("seasons/<int:season_id>/standings/", SeasonStandingsView.as_view(), name="season-standings"),
    path("seasons/<int:season_id>/constructors/", ConstructorStandingsView.as_view(), name="constructor-standings"),
    path("seasons/<int:season_id>/results-matrix/", SeasonResultsMatrixView.as_view(), name="season-results-matrix"),
    path("seasons/<int:season_id>/last-race/", SeasonLastRaceView.as_view(), name="season-last-race"),
    path("seasons/<int:season_id>/races/<int:round>/", RaceDetailView.as_view(), name="race-detail"),
    path("teasers/next-race/", NextRaceTeaserView.as_view(), name="next_race_teaser"),
    path("teasers/history/", HistoryTeaserView.as_view(), name="history_teaser"),
    path("hall-of-fame/", HallOfFameView.as_view(), name="hall_of_fame"),
    path("hall-of-fame/h2h/", HeadToHeadMatrixView.as_view(), name="h2h_matrix"),
    path("rivalry/<int:driver_a>/<int:driver_b>/", RivalryView.as_view(), name="rivalry"),
    # Admin (protected)
    path("admin/races/<int:race_id>/results/", BulkUpsertResultsView.as_view(), name="admin-bulk-results"),
]

