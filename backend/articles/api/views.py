from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response

from entries.models import DriverSeason
from ..models import Article
from .serializers import ArticleListSerializer, ArticleDetailSerializer


class ArticleListView(APIView):
    def get(self, request):
        articles = Article.objects.select_related("race", "race__track").all()
        return Response(ArticleListSerializer(articles, many=True).data)


class ArticleDetailView(APIView):
    def get(self, request, article_id):
        article = get_object_or_404(
            Article.objects.select_related("race", "race__track", "race__season"),
            pk=article_id,
        )
        data = ArticleDetailSerializer(article).data
        human_drivers = (
            DriverSeason.objects
            .filter(season=article.race.season, driver__human=True)
            .select_related("driver")
        )
        data["human_driver_names"] = [
            f"{ds.driver.first_name} {ds.driver.last_name}".strip()
            for ds in human_drivers
        ]
        return Response(data)


class LatestArticlesView(APIView):
    def get(self, request):
        qs = Article.objects.select_related("race", "race__track")
        recap = qs.filter(type=Article.RECAP).first()
        preview = qs.filter(type=Article.PREVIEW).first()
        return Response({
            "recap": ArticleListSerializer(recap).data if recap else None,
            "preview": ArticleListSerializer(preview).data if preview else None,
        })
