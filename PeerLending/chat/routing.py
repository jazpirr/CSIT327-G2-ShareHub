# chat/routing.py
from django.urls import re_path
from .consumer import ChatConsumer   # <-- FIXED import

websocket_urlpatterns = [
    re_path(r'ws/chat/(?P<conversation_id>[^/]+)/$', ChatConsumer.as_asgi()),
]
