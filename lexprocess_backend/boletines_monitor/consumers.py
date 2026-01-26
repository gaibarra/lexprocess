from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class BoletinesConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or user.is_anonymous:
            await self.close()
            return
        try:
            profile = await sync_to_async(lambda: getattr(user, 'profile', None))()
        except Exception:
            profile = None
        if not profile or not profile.despacho_id:
            await self.close()
            return
        self.group_name = f"boletines_despacho_{profile.despacho_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        group = getattr(self, 'group_name', None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def boletin_notificacion(self, event):
        await self.send_json(event.get('payload', {}))
