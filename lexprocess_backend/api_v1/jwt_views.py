# api_v1/jwt_views.py
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView # <--- Importación corregida
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from .jwt_serializers import CustomTokenObtainPairSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Vista para obtener el par de tokens (acceso y refresco)
    utilizando el serializer personalizado para añadir datos del usuario.
    """
    serializer_class = CustomTokenObtainPairSerializer

class LogoutView(APIView):
    """
    Vista para invalidar (añadir a la blacklist) un refresh token.
    Esto efectivamente "cierra la sesión" del usuario.
    """
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token is None:
                return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
            
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        except TokenError:
            # Esto puede pasar si el token está malformado o ya está en la blacklist
            return Response({"detail": "Token is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Captura de errores inesperados
            return Response({"detail": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)