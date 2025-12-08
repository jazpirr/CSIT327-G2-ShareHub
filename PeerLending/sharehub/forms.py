from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import CustomUser



class CustomUserCreationForm(UserCreationForm):
    email = forms.EmailField(required=True)
    first_name = forms.CharField(required=True)
    last_name = forms.CharField(required=True)

    YEAR_LEVEL_CHOICES = [
    ('1', '1st Year'),
    ('2', '2nd Year'),
    ('3', '3rd Year'),
    ('4', '4th Year'),
    ]
    year_level = forms.ChoiceField(choices=YEAR_LEVEL_CHOICES, required=True)

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

    def clean_password1(self):
        password = self.cleaned_data.get("password1")
        email = self.cleaned_data.get("email", "")

        if len(password) < 8:
            raise forms.ValidationError("Password must be at least 8 characters long.")
        if password.lower() == email.lower():
            raise forms.ValidationError("Password cannot be the same as your email.")
        if password.isdigit():
            raise forms.ValidationError("Password cannot be entirely numeric.")
        common_passwords = ["password", "12345678", "qwerty", "test123"]
        if password.lower() in common_passwords:
            raise forms.ValidationError("Password is too common. Choose a stronger one.")

        return password

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")

        if password1 and password2 and password1 != password2:
            self.add_error("password2", "Passwords do not match.")
