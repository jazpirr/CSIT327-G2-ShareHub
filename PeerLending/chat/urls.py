from django.urls import path
from . import views

urlpatterns = [
    path('api/chat/heads/', views.chat_heads, name='chat_heads'),
    path('api/chat/start/<str:item_id>/', views.start_conversation, name='start_conversation'),
    path('api/chat/<str:conversation_id>/messages/', views.get_messages, name='chat_messages'),
    path('api/chat/<str:conversation_id>/post/', views.post_message, name='chat_post_message'),
]
