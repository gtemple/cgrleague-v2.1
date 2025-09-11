from rest_framework import serializers
from tracks.models import Track

class TrackLiteSerializer(serializers.ModelSerializer):
    # expose `img` as `image` for the frontend
    image = serializers.CharField(source="img", allow_null=True)

    class Meta:
        model = Track
        fields = ("id", "name", "city", "country", "image")
