from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("entries", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="teamseason",
            name="color",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Hex color, e.g. #e8002d",
                max_length=7,
            ),
        ),
    ]
