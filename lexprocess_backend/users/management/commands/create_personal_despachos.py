from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction

from despachos.models import Despacho
from users.models import UserProfile


class Command(BaseCommand):
    help = "Crea despachos personales para usuarios sin despacho"

    def handle(self, *args, **options):
        updated = 0
        with transaction.atomic():
            users = User.objects.select_related('profile').all()
            for user in users:
                try:
                    profile = user.profile
                except UserProfile.DoesNotExist:
                    profile = UserProfile.objects.create(user=user)
                if profile.despacho_id:
                    continue
                base_name = f"Despacho de {user.username}"
                name = base_name
                counter = 1
                while Despacho.objects.filter(nombre=name).exists():
                    counter += 1
                    name = f"{base_name} ({counter})"
                despacho = Despacho.objects.create(nombre=name)
                profile.despacho = despacho
                profile.save(update_fields=['despacho'])
                updated += 1

        self.stdout.write(self.style.SUCCESS(f"Despachos personales creados: {updated}"))
