from django.core.management.base import BaseCommand
from tracks.models import Track

DATA = [
    # name, city, country, distance, layout, img
    dict(name="Azerbaijan Grand Prix", city="Baku", country="Azerbaijan", distance=6003, layout="azerbaijan-layout", img="azerbaijan"),
    dict(name="British Grand Prix", city="Silverstone", country="United Kingdom", distance=5861, layout="british-layout", img="british"),
    dict(name="Bahrain Grand Prix", city="Sakhir", country="United Kingdom", distance=5412, layout="bahrain-layout", img="bahrain"),
    dict(name="United States Grand Prix", city="Austin", country="United States", distance=5513, layout="united-states-layout", img="united-states"),
    dict(name="Saudi Arabian Grand Prix", city="Jeddah", country="Saudi Arabia", distance=6174, layout="saudi-arabia-layout", img="saudi-arabia"),
    dict(name="Miami Grand Prix", city="Miami", country="United States", distance=5412, layout="miami-layout", img="miami"),
    dict(name="Emilia Romagna Grand Prix", city="Imola", country="Italy", distance=4909, layout="imola-layout", img="imola"),
    dict(name="Monaco Grand Prix", city="Monte Carlo", country="Monaco", distance=3337, layout="monaco-layout", img="monaco"),
    dict(name="Spanish Grand Prix", city="Barcelona", country="Spain", distance=4657, layout="spanish-layout", img="spanish"),
    dict(name="Canadian Grand Prix", city="Montreal", country="Canada", distance=4361, layout="canada-layout", img="canada"),
    dict(name="Austrian Grand Prix", city="Spielberg", country="Austria", distance=4318, layout="austria-layout", img="austria"),
    dict(name="Hungarian Grand Prix", city="Mogyoród", country="Hungary", distance=4381, layout="hungary-layout", img="hungary"),
    dict(name="Belgian Grand Prix", city="Spa", country="Belgium", distance=7004, layout="belgium-layout", img="belgium"),
    dict(name="Dutch Grand Prix", city="Zandvoort", country="Netherlands", distance=4259, layout="netherlands-layout", img="netherlands"),
    dict(name="Italian Grand Prix", city="Monza", country="Italy", distance=5793, layout="monza-layout", img="monza"),
    dict(name="Singapore Gran Prix", city="Marina Bay", country="Singapore", distance=4928, layout="singapore-layout", img="singapore"),
    dict(name="Japanese Grand Prix", city="Suzuka", country="Japan", distance=5807, layout="japan-layout", img="japan"),
    dict(name="Qatar Grand Prix", city="Lusail", country="Qatar", distance=5418, layout="qatar-layout", img="qatar"),
    dict(name="Mexico City Grand Prix", city="Mexico City", country="Mexico", distance=4304, layout="mexico-layout", img="mexico"),
    dict(name="Sao Paolo Grand Prix", city="Sao Paolo", country="Brazil", distance=4309, layout="brazil-layout", img="brazil"),
    dict(name="Las Vegas Gran Prix", city="Las Vegas", country="United States", distance=6120, layout="las-vegas-layout", img="las-vegas"),
    dict(name="Abu Dhabi Grand Prix", city="Abu Dhabi", country="United Arab Emirates", distance=5281, layout="abu-dhabi-layout", img="abu-dhabi"),
    dict(name="Russian Grand Prix", city="Sochi", country="Russia", distance=5848, layout="russia-layout", img="russia"),
    dict(name="Chinese Grand Prix", city="Shanghai", country="China", distance=5451, layout="china-layout", img="china"),
    dict(name="Portuguese Grand Prix", city="Portimão", country="Portugal", distance=4653, layout="portugal-layout", img="portugal"),
    dict(name="French Grand Prix", city="Le Mans", country="France", distance=5842, layout="france-layout", img="france"),
    dict(name="Australian Grand Prix", city="Melbourne", country="Australia", distance=5278, layout="australia-layout", img="australia"),
]

class Command(BaseCommand):
    help = "Seed the tracks table (id auto-generated). Safe to re-run."

    def handle(self, *args, **options):
        created, updated = 0, 0
        for row in DATA:
            obj, was_created = Track.objects.update_or_create(
                name=row["name"],  # unique identity
                defaults=row,
            )
            if was_created:
                created += 1
            else:
                updated += 1
        self.stdout.write(self.style.SUCCESS(f"Tracks seeded. Created: {created}, Updated: {updated}."))
