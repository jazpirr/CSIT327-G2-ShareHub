from django.contrib.auth.models import AbstractUser, PermissionsMixin
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.conf import settings
import uuid

class CustomUserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, id=None, email=None, password=None, **extra_fields):
        # since Supabase creates users, normally you don't create users from Django.
        if not id and not email:
            raise ValueError("Either Supabase user id or email required")
        if email:
            email = self.normalize_email(email)
        user = self.model(id=id, email=email, **extra_fields)
        # Supabase handles auth; keep unusable password
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, id=None, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(id=id, email=email, password=password, **extra_fields)


class CustomUser(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)

    first_name = models.CharField(max_length=200, null=True, blank=True)
    last_name = models.CharField(max_length=200, null=True, blank=True)
    birthday = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    college_dept = models.CharField(max_length=200, null=True, blank=True)
    course = models.CharField(max_length=200, null=True, blank=True)
    year_level = models.IntegerField(null=True, blank=True)

    is_admin = models.BooleanField(default=False)
    is_block = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)   # add this so Django admin checks work

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["id"]

    objects = CustomUserManager()

    class Meta:
        db_table = "user"
        managed = False   # IMPORTANT: prevent Django from attempting to change the existing Supabase table

    def __str__(self):
        return self.email or str(self.id)

class Item(models.Model):
    item_id = models.UUIDField(primary_key=True)
    title = models.TextField()
    description = models.TextField()
    category = models.TextField()
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    image_url = models.TextField(blank=True, null=True)
    available = models.BooleanField(default=True)
    condition = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "item"
        managed = False

# ✅ UserSettings model
class UserSettings(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    show_email = models.BooleanField(default=False)
    show_profile = models.BooleanField(default=True)
    allow_sharing = models.BooleanField(default=True)
    profile_visibility = models.BooleanField(default=False)
    contact_information = models.BooleanField(default=False)
    contact_email = models.EmailField(blank=True, null=True)
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email}'s Settings"  
  