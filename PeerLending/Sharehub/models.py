from django.db import models
import uuid


class User(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(unique=True)
    birthday = models.DateField(blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    college_dept = models.CharField(max_length=100, blank=True, null=True)
    course = models.CharField(max_length=100, blank=True, null=True)
    year_level = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    student_id = models.CharField(max_length=50, blank=True, null=True)
    profile_picture = models.URLField(blank=True, null=True)
    is_admin = models.BooleanField(default=False)

    class Meta:
        db_table = "user"  # matches Supabase table name

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"


class Item(models.Model):
    item_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=100)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")
    image_url = models.URLField(blank=True, null=True)
    available = models.BooleanField(default=True)
    condition = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = "item"

    def __str__(self):
        return self.title


class Request(models.Model):
    request_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, db_column="item_id")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")
    request_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=50, default="Pending")

    class Meta:
        db_table = "request"

    def __str__(self):
        return f"Request {self.request_id} - {self.status}"


class Transaction(models.Model):
    transaction_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(Request, on_delete=models.CASCADE, db_column="request_id")
    borrow_date = models.DateField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)
    return_date = models.DateField(blank=True, null=True)
    return_condition = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = "transaction"

    def __str__(self):
        return f"Transaction {self.transaction_id}"


class Notification(models.Model):
    notification_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")
    message = models.TextField()
    notif_type = models.CharField(max_length=100, blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notification"

    def __str__(self):
        return f"Notification to {self.user.email}"
