# tracks/api/urls.py
from django.urls import path
from .views import TrackDriverStatsView, TrackListView, TracksHomepageView

urlpatterns = [
    path("tracks/", TrackListView.as_view(), name="track-list"),
    path("tracks/homepage/", TracksHomepageView.as_view(), name="tracks-homepage"),
    path("tracks/<int:track_id>/stats/", TrackDriverStatsView.as_view(), name="track-stats"),
]
