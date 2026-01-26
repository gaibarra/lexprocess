import uuid
from django.urls import reverse
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from despachos.models import Despacho
from casos.models import Caso, Cliente
from documentos.models import Documento


class HealthEndpointTests(APITestCase):
    def test_health_ok(self):
        resp = self.client.get('/api/health/')
        assert resp.status_code in (200, 503)
        data = resp.json()
        assert 'database' in data and 'redis' in data


class DocumentExtractionTaskTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tester', password='pass')
        self.client.force_authenticate(self.user)
        self.despacho = Despacho.objects.create(nombre='Despacho Prueba')
        profile = self.user.profile
        profile.despacho = self.despacho
        profile.save()
        self.cliente = Cliente.objects.create(nombre_completo='Cliente X', despacho=self.despacho)
        self.caso = Caso.objects.create(despacho=self.despacho, nombre_caso='Caso X')

    def test_upload_txt_triggers_pending_state(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        content = b"Documento de prueba."
        file = SimpleUploadedFile('doc_prueba.txt', content, content_type='text/plain')
        url = reverse('documento-list')
        payload = {
            'caso_id': str(self.caso.id),
            'nombre_documento': 'Doc TXT',
            'archivo': file
        }
        resp = self.client.post(url, payload, format='multipart')
        assert resp.status_code == 202, resp.content
        doc_id = resp.json()['id']
        documento = Documento.objects.get(id=doc_id)
        # En modo eager la tarea puede haber avanzado rápido
        assert documento.processing_status in ('PENDIENTE', 'PROCESANDO', 'PROCESADO'), documento.processing_status
        if documento.processing_status == 'PROCESADO':
            assert documento.texto_extraido is not None and len(documento.texto_extraido) > 0
