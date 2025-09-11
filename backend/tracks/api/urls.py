# tracks/api/urls.py
from django.urls import path
from .views import TrackDriverStatsView, TrackListView

urlpatterns = [
    path("tracks/", TrackListView.as_view(), name="track-list"),
    path("tracks/<int:track_id>/stats/", TrackDriverStatsView.as_view(), name="track-stats"),
]
