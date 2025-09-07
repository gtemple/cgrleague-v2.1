# drivers/management/commands/seed_drivers.py
from django.core.management.base import BaseCommand
from datetime import date
from drivers.models import Driver

DATA = [
    # first_name, last_name, initials, city_of_birth, country_of_birth, human, date_of_birth, profile_image, country_of_representation
    dict(first_name="Giordano", last_name="Temple", initials="TEM", city_of_birth="Toronto", country_of_birth="Canada",  human=True,  date_of_birth=date(1993, 3, 11),  profile_image="giordano-temple",   country_of_representation="canada"),
    dict(first_name="Cole",     last_name="Reynolds", initials="CAR", city_of_birth="Toronto", country_of_birth="Canada",  human=True,  date_of_birth=date(1996,10,10),  profile_image="cole-reynolds",     country_of_representation="canada"),
    dict(first_name="Ryan",     last_name="Reynolds", initials="RCR", city_of_birth="Toronto", country_of_birth="Canada",  human=True,  date_of_birth=date(1992,12, 5),  profile_image="ryan-reynolds",     country_of_representation="canada"),
    dict(first_name="Charles",  last_name="Leclerc",  initials="LEC", city_of_birth="Monte Carlo", country_of_birth="Monaco", human=False, date_of_birth=date(1997,10,16), profile_image="charles-leclerc", country_of_representation="monaco"),
    dict(first_name="Lando",    last_name="Norris",   initials="NOR", city_of_birth="Bristol", country_of_birth="United Kingdom", human=False, date_of_birth=date(1999,11,13), profile_image="lando-norris", country_of_representation="united-kingdom"),
    dict(first_name="Fernando", last_name="Alonso",   initials="ALO", city_of_birth="Oviedo",  country_of_birth="Spain",   human=False, date_of_birth=date(1981, 7,29),  profile_image="fernando-alonso",  country_of_representation="spain"),
    dict(first_name="Lance",    last_name="Stroll",   initials="STR", city_of_birth="Montreal", country_of_birth="Canada", human=False, date_of_birth=date(1998,10,29), profile_image="lance-stroll",    country_of_representation="canada"),
    dict(first_name="Nicholas", last_name="Latifi",   initials="LAT", city_of_birth="Montreal", country_of_birth="Canada", human=False, date_of_birth=date(1995, 6,27),  profile_image="nicholas-latifi", country_of_representation="canada"),
    dict(first_name="Alexander",last_name="Albon",    initials="ALB", city_of_birth="London",  country_of_birth="United Kingdom", human=False, date_of_birth=date(1996, 3,23), profile_image="alex-albon", country_of_representation="thailand"),
    dict(first_name="Logan",    last_name="Sargeant", initials="SAR", city_of_birth="Fort Lauderdale", country_of_birth="United States", human=False, date_of_birth=date(2000,12,31), profile_image="logan-sargeant", country_of_representation="united-states"),
    dict(first_name="Lewis",    last_name="Hamilton", initials="HAM", city_of_birth="Stevenage", country_of_birth="United Kingdom", human=False, date_of_birth=date(1985, 1, 7), profile_image="lewis-hamilton", country_of_representation="united-kingdom"),
    dict(first_name="George",   last_name="Russel",   initials="RUS", city_of_birth="Kings Lynn", country_of_birth="United Kingdom", human=False, date_of_birth=date(1998, 2,15), profile_image="george-russel", country_of_representation="united-kingdom"),
    dict(first_name="Max",      last_name="Verstappen", initials="VER", city_of_birth="Hasselt", country_of_birth="Belgium", human=False, date_of_birth=date(1997, 9,30), profile_image="max-verstappen", country_of_representation="netherlands"),
    dict(first_name="Sergio",   last_name="Perez",    initials="PER", city_of_birth="Guadalajara", country_of_birth="Mexico", human=False, date_of_birth=date(1990, 1,26), profile_image="sergio-perez", country_of_representation="mexico"),
    dict(first_name="Valtteri", last_name="Bottas",   initials="BOT", city_of_birth="Nastola", country_of_birth="Finland", human=False, date_of_birth=date(1989, 8,28), profile_image="valtteri-bottas", country_of_representation="finland"),
    dict(first_name="Zhou",     last_name="Guanyu",   initials="ZHO", city_of_birth="Shanghai", country_of_birth="China",  human=False, date_of_birth=date(1999, 5,30), profile_image="zhou-guanyu", country_of_representation="china"),
    dict(first_name="Kimi",     last_name="Räikkönen", initials="RAI", city_of_birth="Espoo",  country_of_birth="Finland", human=False, date_of_birth=date(1979,10,17), profile_image="kimi-raikkonen", country_of_representation="finland"),
    dict(first_name="Antonio",  last_name="Giovinazzi", initials="GIO", city_of_birth="Martina Franca", country_of_birth="Italy", human=False, date_of_birth=date(1993,12,14), profile_image="antonio-giovinazzi", country_of_representation="italy"),
    dict(first_name="Oscar",    last_name="Piastri",  initials="PIA", city_of_birth="Melbourne", country_of_birth="Australia", human=False, date_of_birth=date(2001, 4, 6), profile_image="oscar-piastri", country_of_representation="australia"),
    dict(first_name="Pierre",   last_name="Gasly",    initials="GAS", city_of_birth="Rouen",  country_of_birth="France",  human=False, date_of_birth=date(1996, 2, 7), profile_image="pierre-gasly", country_of_representation="france"),
    dict(first_name="Yuki",     last_name="Tsunoda",  initials="TSU", city_of_birth="Sagamihara", country_of_birth="Japan", human=False, date_of_birth=date(2000, 5,11), profile_image="yuki-tsunoda", country_of_representation="japan"),
    dict(first_name="Nyck",     last_name="de Vries", initials="DEV", city_of_birth="Uitwellingerga", country_of_birth="Netherlands", human=False, date_of_birth=date(1995, 2, 6), profile_image="nyck-devries", country_of_representation="netherlands"),
    dict(first_name="Daniel",   last_name="Ricciardo", initials="RIC", city_of_birth="Perth", country_of_birth="Australia", human=False, date_of_birth=date(1989, 7, 1), profile_image="daniel-ricciardo", country_of_representation="australia"),
    dict(first_name="Esteban",  last_name="Ocon",     initials="OCO", city_of_birth="Évreux", country_of_birth="France",  human=False, date_of_birth=date(1996, 9,17), profile_image="esteban-ocon", country_of_representation="france"),
    dict(first_name="Mick",     last_name="Schumacher", initials="SCH", city_of_birth="Genolier", country_of_birth="Switzerland", human=False, date_of_birth=date(1999, 3,24), profile_image="mick-schumacher", country_of_representation="germany"),
    dict(first_name="Nikita",   last_name="Mazepin",  initials="MAZ", city_of_birth="Moscow", country_of_birth="Russia",  human=False, date_of_birth=date(1999, 3, 2), profile_image="nikita-mazepin", country_of_representation="russia"),
    dict(first_name="Nico",     last_name="Hülkenberg", initials="HUL", city_of_birth="Emmerich", country_of_birth="Germany", human=False, date_of_birth=date(1987, 8,19), profile_image="nico-hulkenberg", country_of_representation="germany"),
    dict(first_name="Kevin",    last_name="Magnussen", initials="MAG", city_of_birth="Roskilde", country_of_birth="Denmark", human=False, date_of_birth=date(1992,10, 5), profile_image="kevin-magnussen", country_of_representation="denmark"),
    dict(first_name="Carlos",   last_name="Sainz",    initials="SAI", city_of_birth="Madrid", country_of_birth="Spain",   human=False, date_of_birth=date(1994, 9, 1), profile_image="carlos-sainz", country_of_representation="spain"),
    dict(first_name="Sebastian",last_name="Vettel",   initials="VET", city_of_birth="Heppenheim", country_of_birth="Germany", human=False, date_of_birth=date(1987, 7, 3), profile_image="sebastian-vettel", country_of_representation="germany"),
]

class Command(BaseCommand):
    help = "Seed the drivers table with initial data (id auto-generated). Safe to re-run."

    def handle(self, *args, **options):
        created, updated = 0, 0
        for row in DATA:
            # Use a stable identity to avoid duplicates; tweak keys if you prefer
            obj, was_created = Driver.objects.update_or_create(
                first_name=row["first_name"],
                last_name=row["last_name"],
                date_of_birth=row["date_of_birth"],
                defaults=row,
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(f"Drivers seeded. Created: {created}, Updated: {updated}."))
