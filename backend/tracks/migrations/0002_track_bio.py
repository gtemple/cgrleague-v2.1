from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tracks', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='track',
            name='bio',
            field=models.TextField(blank=True, null=True),
        ),
    ]
