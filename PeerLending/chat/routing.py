# chat/routing.py
from django.urls import re_path
from channels.routing import URLRouter
from channels.auth import AuthMiddlewareStack
from . import consumers

websocket_urlpatterns = [
    # adjust the path to match what your frontend opens
    re_path(r'ws/chat/(?P<conversation_id>[^/]+)/$', consumers.ChatConsumer.as_asgi()),
]
