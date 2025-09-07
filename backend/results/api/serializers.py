from rest_framework import serializers

class TeamSlimSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()

class DriverSlimSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    display_name = serializers.SerializerMethodField()

    def get_display_name(self, obj):
        first = getattr(obj, "first_name", "") or ""
        last = getattr(obj, "last_name", "") or ""
        return (first + " " + last).strip() or getattr(obj, "name", "")

class StandingRowSerializer(serializers.Serializer):
    driver_season_id = serializers.IntegerField(source="id")
    points = serializers.IntegerField()
    driver = DriverSlimSerializer(source="driver")
    team = TeamSlimSerializer(source="team")