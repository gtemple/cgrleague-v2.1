from django.urls import path
from .views import DriversListView, DriverDetailView, DriverHistoryView, DriverTrackStatsView, DriversHomepageView, DriverSpecializationView

urlpatterns = [
    path("drivers/", DriversListView.as_view(), name="drivers-list"),
    path("drivers/homepage/", DriversHomepageView.as_view(), name="drivers-homepage"),
    path("drivers/<int:driver_id>/", DriverDetailView.as_view(), name="driver-detail"),
    path("drivers/<int:driver_id>/history/", DriverHistoryView.as_view(), name="driver-history"),
    path("drivers/<int:driver_id>/tracks/", DriverTrackStatsView.as_view(), name="driver-tracks"),
    path("drivers/<int:driver_id>/specialization/", DriverSpecializationView.as_view(), name="driver-specialization"),
]