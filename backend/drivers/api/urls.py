from django.urls import path
from .views import DriversListView, DriverDetailView, DriverHistoryView, DriverTrackStatsView

urlpatterns = [
    path("drivers/", DriversListView.as_view(), name="drivers-list"),
    path("drivers/<int:driver_id>/", DriverDetailView.as_view(), name="driver-detail"),
    path("drivers/<int:driver_id>/history/", DriverHistoryView.as_view(), name="driver-history"),
    path("drivers/<int:driver_id>/tracks/", DriverTrackStatsView.as_view(), name="driver-tracks"),
]