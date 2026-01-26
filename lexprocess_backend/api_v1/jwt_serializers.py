# api_v1/jwt_serializers.py
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .serializers import UserSimpleSerializer
from users.models import UserProfile

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Añadir claims personalizados para validaciones en gateways sin llamada extra
        token['username'] = user.username
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        try:
            profile = user.profile
            token['rol'] = profile.rol
            if profile.despacho:
                token['despacho_id'] = str(profile.despacho.id)
        except UserProfile.DoesNotExist:  # pragma: no cover
            pass

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # Datos básicos del usuario
        base_user = UserSimpleSerializer(self.user).data

        # Perfil (rol, despacho) si existe
        profile_payload = None
        try:
            profile = self.user.profile
            profile_payload = {
                'rol': profile.rol,
                'despacho_id': profile.despacho.id if profile.despacho else None,
                'despacho_nombre': profile.despacho.nombre if profile.despacho else None,
            }
        except UserProfile.DoesNotExist:  # pragma: no cover
            profile_payload = None

        permissions = {
            'is_staff': self.user.is_staff,
            'is_superuser': self.user.is_superuser,
        }

        data['user'] = { **base_user, 'profile': profile_payload, 'permissions': permissions }

        return data