from django.urls import path
from .views import SeasonStandingsView
from .views import ConstructorStandingsView

urlpatterns = [
    path("seasons/<int:season_id>/standings/", SeasonStandingsView.as_view(), name="season-standings"),
    path("seasons/<int:season_id>/constructors/", ConstructorStandingsView.as_view(), name="constructor-standings"),
]

