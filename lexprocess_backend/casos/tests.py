# casos/tests.py
import pytest
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.auth.models import User
from despachos.models import Despacho
from casos.models import Caso

@pytest.mark.django_db
class CasoAPITests(APITestCase):

    def setUp(self):
        """Configuración inicial para todas las pruebas de esta clase."""
        self.despacho1 = Despacho.objects.create(nombre="Garrigues")
        self.despacho2 = Despacho.objects.create(nombre="Cuatrecasas")

        self.admin1 = User.objects.create_user(username='admin_garrigues', password='password123')
        self.admin1.profile.despacho = self.despacho1
        self.admin1.profile.rol = 'ADMINISTRADOR'
        self.admin1.profile.save()

        self.abogado1 = User.objects.create_user(username='abogado_garrigues', password='password123')
        self.abogado1.profile.despacho = self.despacho1
        self.abogado1.profile.save()
        
        self.abogado2 = User.objects.create_user(username='abogado_cuatrecasas', password='password123')
        self.abogado2.profile.despacho = self.despacho2
        self.abogado2.profile.save()

        self.caso1 = Caso.objects.create(
            despacho=self.despacho1,
            nombre_caso="Fusión Megacorp",
            abogado_asignado=self.abogado1
        )
        
        # Obtenemos tokens para abogado1 y lo usamos para las peticiones
        response = self.client.post(reverse('token_obtain_pair'), {'username': 'abogado_garrigues', 'password': 'password123'})
        self.access_token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')

    def test_abogado_lista_solo_casos_de_su_despacho(self):
        """Verifica que un abogado solo ve los casos de su firma."""
        # Creamos un caso en el otro despacho para asegurarnos que no aparezca
        Caso.objects.create(despacho=self.despacho2, nombre_caso="Caso Secreto")
        
        url = reverse('caso-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['nombre_caso'], self.caso1.nombre_caso)

    def test_abogado_no_puede_actualizar_caso_otro_despacho(self):
        """Verifica que un abogado no puede modificar casos de otra firma."""
        caso_secreto = Caso.objects.create(despacho=self.despacho2, nombre_caso="Caso Secreto")
        url = reverse('caso-detail', kwargs={'pk': caso_secreto.pk})
        data = {'nombre_caso': 'Caso Editado Ilegalmente'}

        response = self.client.patch(url, data, format='json')
        
        # DRF devuelve 404 por seguridad para objetos a los que no se tiene acceso
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_abogado_asignado_puede_actualizar_su_caso(self):
        """Verifica que el abogado asignado puede modificar su propio caso."""
        url = reverse('caso-detail', kwargs={'pk': self.caso1.pk})
        data = {'juzgado_tribunal': 'Audiencia Nacional'}
        response = self.client.patch(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.caso1.refresh_from_db()
        self.assertEqual(self.caso1.juzgado_tribunal, 'Audiencia Nacional')

    def test_admin_despacho_puede_actualizar_caso_no_asignado(self):
        """Verifica que un admin de despacho puede modificar un caso de su firma, aunque no esté asignado a él."""
        # Iniciamos sesión como el administrador
        response = self.client.post(reverse('token_obtain_pair'), {'username': 'admin_garrigues', 'password': 'password123'})
        admin_token = response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')

        url = reverse('caso-detail', kwargs={'pk': self.caso1.pk})
        data = {'nombre_caso': 'Caso Reasignado por Admin'}
        response = self.client.patch(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.caso1.refresh_from_db()
        self.assertEqual(self.caso1.nombre_caso, 'Caso Reasignado por Admin')