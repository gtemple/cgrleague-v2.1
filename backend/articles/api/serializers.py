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
    race = serializers.SerializerMethodField()
    season_id = serializers.SerializerMethodField()
    season_game = serializers.SerializerMethodField()
    reading_time_minutes = serializers.SerializerMethodField()
    biggest_movers = serializers.SerializerMethodField()
    session_summary = serializers.SerializerMethodField()

    def get_session_summary(self, obj):
        """Round span and race count, so a session card can label itself without
        pulling the whole session payload into the list response."""
        if obj.type != "SESSION" or not obj.session_data:
            return None
        return {
            "race_count": obj.session_data.get("race_count"),
            "round_span": obj.session_data.get("round_span"),
        }

    def get_race(self, obj):
        if obj.race_id is None:
            return None
        return RaceSlimSerializer(obj.race).data

    def get_season_id(self, obj):
        if obj.season_id is not None:
            return obj.season_id
        if obj.race_id is not None:
            return obj.race.season_id
        return None

    def get_season_game(self, obj):
        if obj.season_id is not None:
            return obj.season.game
        if obj.race_id is not None:
            return obj.race.season.game
        return None

    def get_reading_time_minutes(self, obj):
        words = len(obj.content.split()) if obj.content else 0
        return max(1, round(words / 200))

    def get_biggest_movers(self, obj):
        if obj.type != "POWER_RANKINGS" or not obj.rankings_data:
            return None
        return obj.rankings_data.get("biggest_movers", [])


class ArticleDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    type = serializers.CharField()
    title = serializers.CharField()
    teaser = serializers.CharField()
    content = serializers.CharField()
    rivalry_callout = serializers.CharField()
    preview_sidebar = serializers.JSONField(default=None)
    rankings_data = serializers.JSONField(default=None)
    session_data = serializers.JSONField(default=None)
    generated_at = serializers.DateTimeField()
    race = serializers.SerializerMethodField()
    session_races = serializers.SerializerMethodField()
    season_id = serializers.SerializerMethodField()
    reading_time_minutes = serializers.SerializerMethodField()

    def get_session_races(self, obj):
        if obj.type != "SESSION":
            return None
        return RaceSlimSerializer(obj.session_races.all(), many=True).data

    def get_race(self, obj):
        if obj.race_id is None:
            return None
        return RaceSlimSerializer(obj.race).data

    def get_season_id(self, obj):
        if obj.season_id is not None:
            return obj.season_id
        if obj.race_id is not None:
            return obj.race.season_id
        return None

    def get_reading_time_minutes(self, obj):
        words = len(obj.content.split()) if obj.content else 0
        return max(1, round(words / 200))
