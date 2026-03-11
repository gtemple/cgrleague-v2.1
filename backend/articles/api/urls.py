from django.urls import path
from .views import ArticleListView, ArticleDetailView, LatestArticlesView

urlpatterns = [
    path("articles/latest/", LatestArticlesView.as_view(), name="article-latest"),
    path("articles/", ArticleListView.as_view(), name="article-list"),
    path("articles/<int:article_id>/", ArticleDetailView.as_view(), name="article-detail"),
]
