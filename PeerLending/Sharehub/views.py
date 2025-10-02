from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from django.contrib import messages
from .forms import CustomUserCreationForm
from django.contrib.auth.decorators import login_required


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
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect("home")
        else:
            messages.error(request, "Invalid username or password")
    return render(request, "login-register/login.html")


def logout_view(request):
    if request.method == "POST":
        logout(request)
        return redirect("login")
    else:
        return redirect("home") 

def profile(request):
    return render(request,"profile.html")