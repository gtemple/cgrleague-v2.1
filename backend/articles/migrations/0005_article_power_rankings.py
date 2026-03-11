from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("articles", "0004_add_preview_sidebar"),
    ]

    operations = [
        migrations.AddField(
            model_name="article",
            name="rankings_data",
            field=models.JSONField(blank=True, default=None, null=True),
        ),
        migrations.AlterField(
            model_name="article",
            name="content",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="article",
            name="type",
            field=models.CharField(
                choices=[
                    ("RECAP", "Race Recap"),
                    ("PREVIEW", "Race Preview"),
                    ("SEASON_RECAP", "Season Recap"),
                    ("SEASON_PREVIEW", "Season Preview"),
                    ("POWER_RANKINGS", "Power Rankings"),
                ],
                max_length=15,
            ),
        ),
    ]
