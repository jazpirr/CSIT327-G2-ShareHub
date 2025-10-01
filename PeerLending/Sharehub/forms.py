from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import CustomUser

class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(required=True)
    first_name = forms.CharField(required=True)
    last_name = forms.CharField(required=True)

    class Meta:
        model = CustomUser
        fields = [
            "first_name",
            "last_name",
            "email",
            "password1",
            "password2",
            "birthday",
            "phone_number",
            "college_dept",
            "course",
            "year_level",
        ]

    def clean_email(self):
        email = self.cleaned_data.get("email")

        if not email.lower().endswith("@cit.edu"):
            raise forms.ValidationError("Email must be a valid @cit.edu address.")

        if CustomUser.objects.filter(email=email).exists():
            raise forms.ValidationError("This email is already registered. Please use another.")

        return email
