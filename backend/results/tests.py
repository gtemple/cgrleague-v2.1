from datetime import date

from django.core.cache import cache
from django.test import TestCase

from drivers.models import Driver
from entries.models import DriverSeason, TeamSeason
from results.models import Race, RaceResult
from seasons.models import Season
from teams.models import Team
from tracks.models import Track


class PreRaceCentreApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.track = Track.objects.create(
            name="Test Circuit", city="Toronto", country="Canada", distance=4321
        )
        self.team = Team.objects.create(team_name="Test Racing")
        self.alex = Driver.objects.create(
            first_name="Alex", last_name="Alpha", initials="AA",
            city_of_birth="Toronto", country_of_birth="Canada",
            date_of_birth=date(1990, 1, 1), human=True,
        )
        self.blake = Driver.objects.create(
            first_name="Blake", last_name="Beta", initials="BB",
            city_of_birth="Toronto", country_of_birth="Canada",
            date_of_birth=date(1991, 1, 1), human=False,
        )

        old_season = Season.objects.create(game="F1 24")
        old_team = TeamSeason.objects.create(season=old_season, team=self.team, color="#112233")
        old_alex = DriverSeason.objects.create(season=old_season, driver=self.alex, team_season=old_team)
        old_blake = DriverSeason.objects.create(season=old_season, driver=self.blake, team_season=old_team)
        old_race = Race.objects.create(season=old_season, track=self.track, round=1)
        RaceResult.objects.create(race=old_race, driver_season=old_alex, finish_position=1)
        RaceResult.objects.create(race=old_race, driver_season=old_blake, finish_position=2)

        self.season = Season.objects.create(game="F1 25")
        team_season = TeamSeason.objects.create(season=self.season, team=self.team, color="#445566")
        self.alex_seat = DriverSeason.objects.create(
            season=self.season, driver=self.alex, team_season=team_season
        )
        self.blake_seat = DriverSeason.objects.create(
            season=self.season, driver=self.blake, team_season=team_season
        )
        opener = Race.objects.create(season=self.season, track=self.track, round=1)
        RaceResult.objects.create(race=opener, driver_season=self.alex_seat, finish_position=2)
        RaceResult.objects.create(race=opener, driver_season=self.blake_seat, finish_position=1)
        self.round_two = Race.objects.create(season=self.season, track=self.track, round=2)
        self.upcoming = Race.objects.create(
            season=self.season, track=self.track, round=3, laps=57
        )

    def test_upcoming_race_includes_form_standings_and_circuit_specialists(self):
        url = f"/api/seasons/{self.season.id}/races/{self.upcoming.round}/"
        first = self.client.get(url)

        self.assertEqual(first.status_code, 200)
        payload = first.json()
        self.assertEqual(payload["results"], [])
        self.assertEqual(payload["pre_race"]["completed_races"], 1)
        self.assertEqual(payload["pre_race"]["standings"][0]["driver"]["id"], self.blake.id)
        self.assertEqual(payload["pre_race"]["standings"][0]["form"], [1])
        self.assertEqual(payload["pre_race"]["circuit_specialists"][0]["driver"]["id"], self.alex.id)
        self.assertEqual(payload["pre_race"]["circuit_specialists"][0]["wins"], 1)

        # The first request is cached. Entering an earlier round must still
        # refresh the upcoming centre's championship and form snapshot.
        RaceResult.objects.create(
            race=self.round_two, driver_season=self.alex_seat, finish_position=1
        )
        refreshed = self.client.get(url).json()
        alex = next(
            row for row in refreshed["pre_race"]["standings"]
            if row["driver"]["id"] == self.alex.id
        )
        self.assertEqual(refreshed["pre_race"]["completed_races"], 2)
        self.assertEqual(alex["points"], 43)
        self.assertEqual(alex["form"], [2, 1])
