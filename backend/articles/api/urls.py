from django.urls import path
from .admin_views import SessionGenerateView, SessionRacesView
from .views import ArticleListView, ArticleDetailView, LatestArticlesView

urlpatterns = [
    path("articles/latest/", LatestArticlesView.as_view(), name="article-latest"),
    path("articles/", ArticleListView.as_view(), name="article-list"),
    path("articles/<int:article_id>/", ArticleDetailView.as_view(), name="article-detail"),
    # Admin (token-authenticated)
    path("admin/sessions/", SessionRacesView.as_view(), name="admin-sessions"),
    path("admin/sessions/generate/", SessionGenerateView.as_view(), name="admin-session-generate"),
]
