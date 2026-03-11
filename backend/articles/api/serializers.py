from rest_framework import serializers


class TrackSlimSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class RaceSlimSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    round = serializers.IntegerField()
    is_sprint = serializers.BooleanField()
    season_id = serializers.IntegerField()
    track = TrackSlimSerializer()


class ArticleListSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.CharField()
    title = serializers.CharField()
    teaser = serializers.CharField()
    generated_at = serializers.DateTimeField()
    race = RaceSlimSerializer()


class ArticleDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.CharField()
    title = serializers.CharField()
    teaser = serializers.CharField()
    content = serializers.CharField()
    generated_at = serializers.DateTimeField()
    race = RaceSlimSerializer()
