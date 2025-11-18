# chat/models.py
from django.conf import settings
from django.db import models
from django.utils import timezone

class Conversation(models.Model):
    # store item metadata instead of FK so we don't require sharehub.Item
    item_id = models.CharField(max_length=128, blank=True, null=True)
    item_title = models.CharField(max_length=255, blank=True, null=True)
    item_owner_id = models.CharField(max_length=128, blank=True, null=True)
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)

    def last_message(self):
        return self.messages.order_by('-created_at').first()

    def __str__(self):
        return f"Conversation for {self.item_title or self.item_id} ({self.id})"

class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']
