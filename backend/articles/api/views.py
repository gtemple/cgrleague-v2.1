from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response

from entries.models import DriverSeason
from ..models import Article
from .serializers import ArticleListSerializer, ArticleDetailSerializer


class ArticleListView(APIView):
    def get(self, request):
        articles = Article.objects.select_related("race", "race__track", "race__season", "season").all()
        season_id = request.query_params.get("season_id")
        round_num = request.query_params.get("round")
        if season_id and round_num:
            articles = articles.filter(race__season_id=season_id, race__round=round_num)
        return Response(ArticleListSerializer(articles, many=True).data)


class ArticleDetailView(APIView):
    def get(self, request, article_id):
        article = get_object_or_404(
            Article.objects.select_related("race", "race__track", "race__season", "season"),
            pk=article_id,
        )
        data = ArticleDetailSerializer(article).data

        # Resolve the season: season articles use article.season, race articles use race.season
        if article.season_id is not None:
            season = article.season
        elif article.race_id is not None:
            season = article.race.season
        else:
            season = None

        if season:
            human_drivers = (
                DriverSeason.objects
                .filter(season=season, driver__human=True)
                .select_related("driver")
            )
            data["human_driver_names"] = [
                f"{ds.driver.first_name} {ds.driver.last_name}".strip()
                for ds in human_drivers
            ]
        else:
            data["human_driver_names"] = []

        return Response(data)


class LatestArticlesView(APIView):
    def get(self, request):
        from results.models import Race, RaceResult

        qs = Article.objects.select_related("race", "race__track", "season")

        # Races that have at least one result recorded (completed)
        completed_race_ids = set(
            RaceResult.objects.values_list("race_id", flat=True).distinct()
        )

        # Upcoming = races with no results, ordered earliest first
        upcoming_race_ids = list(
            Race.objects
            .exclude(id__in=completed_race_ids)
            .order_by("season_id", "round")
            .values_list("id", flat=True)
        )

        # PREVIEW: article for the next upcoming race; fall back to most recent completed
        if upcoming_race_ids:
            preview = (
                qs.filter(type=Article.PREVIEW, race_id__in=upcoming_race_ids)
                .order_by("race__season_id", "race__round")
                .first()
            )
        else:
            preview = None
        if preview is None:
            # Fallback: most recent completed race's preview
            preview = (
                qs.filter(type=Article.PREVIEW, race_id__in=completed_race_ids)
                .order_by("-race__season_id", "-race__round")
                .first()
            )

        # RECAP + RANKINGS: most recently completed race
        recap = (
            qs.filter(type=Article.RECAP, race_id__in=completed_race_ids)
            .order_by("-race__season_id", "-race__round")
            .first()
        )
        rankings = (
            qs.filter(type=Article.POWER_RANKINGS, race_id__in=completed_race_ids)
            .order_by("-race__season_id", "-race__round")
            .first()
        )

        return Response({
            "recap": ArticleListSerializer(recap).data if recap else None,
            "preview": ArticleListSerializer(preview).data if preview else None,
            "rankings": ArticleListSerializer(rankings).data if rankings else None,
        })
