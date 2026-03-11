from rest_framework import serializers


class TrackSlimSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    img = serializers.CharField(default=None)
    country = serializers.CharField(default=None)


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
    reading_time_minutes = serializers.SerializerMethodField()

    def get_reading_time_minutes(self, obj):
        words = len(obj.content.split())
        return max(1, round(words / 200))


class ArticleDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.CharField()
    title = serializers.CharField()
    teaser = serializers.CharField()
    content = serializers.CharField()
    rivalry_callout = serializers.CharField()
    generated_at = serializers.DateTimeField()
    race = RaceSlimSerializer()
    reading_time_minutes = serializers.SerializerMethodField()

    def get_reading_time_minutes(self, obj):
        words = len(obj.content.split())
        return max(1, round(words / 200))
