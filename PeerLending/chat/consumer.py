# chat/consumers.py
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        # Optionally join a group for the conversation here
        await self.accept()

    async def disconnect(self, close_code):
        # Clean up group membership if used
        pass

    async def receive_json(self, content, **kwargs):
        # Basic echo handler — replace with your message broadcast/DB logic
        await self.send_json({"received": content})
