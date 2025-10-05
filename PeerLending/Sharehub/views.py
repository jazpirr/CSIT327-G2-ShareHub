from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from django.contrib import messages
from .forms import CustomUserCreationForm
from django.contrib.auth.decorators import login_required
from django import forms
from django.contrib.auth import get_user_model

User = get_user_model()

def register(request):
    if request.method == "POST":
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()  
            messages.success(request, "Account created successfully! Please log in.")
            return redirect("login") 
        else:
            messages.error(request, "Please correct the errors below.")
            print(form.errors)  
    else:
        form = CustomUserCreationForm()
    return render(request, "login-register/register.html", {"form": form})



@login_required(login_url="login")
def home(request):
    return render(request, "home.html")

def login_view(request):
    class LoginForm(forms.Form):
        email = forms.EmailField(label="Email")
        password = forms.CharField(widget=forms.PasswordInput)

    errors = {}

    if request.method == "POST":
        form = LoginForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data["email"]
            password = form.cleaned_data["password"]

            user = authenticate(request, email=email, password=password)
            if user is not None:
                login(request, user)
                return redirect("home")
            else:
                if User.objects.filter(email=email).exists():
                    errors['password'] = [{"message": "Incorrect password"}]
                else:
                    errors['email'] = [{"message": "Email not registered"}]
        else:
            for field, field_errors in form.errors.items():
                errors[field] = [{"message": e} for e in field_errors]
    else:
        form = LoginForm()

    return render(request, "login-register/login.html", {"form": form, "errors": errors})




def logout_view(request):
    if request.method == "POST":
        logout(request)
        return redirect("login")
    else:
        return redirect("home") 

def profile(request):
    return render(request,"profile.html")