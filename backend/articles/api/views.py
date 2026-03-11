from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response

from ..models import Article
from .serializers import ArticleListSerializer, ArticleDetailSerializer


class ArticleListView(APIView):
    def get(self, request):
        articles = Article.objects.select_related("race", "race__track").all()
        return Response(ArticleListSerializer(articles, many=True).data)


class ArticleDetailView(APIView):
    def get(self, request, article_id):
        article = get_object_or_404(
            Article.objects.select_related("race", "race__track"),
            pk=article_id,
        )
        return Response(ArticleDetailSerializer(article).data)


class LatestArticlesView(APIView):
    def get(self, request):
        qs = Article.objects.select_related("race", "race__track")
        recap = qs.filter(type=Article.RECAP).first()
        preview = qs.filter(type=Article.PREVIEW).first()
        return Response({
            "recap": ArticleListSerializer(recap).data if recap else None,
            "preview": ArticleListSerializer(preview).data if preview else None,
        })
