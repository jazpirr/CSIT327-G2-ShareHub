from django.shortcuts import render, redirect
from django.contrib import messages
from django.conf import settings
from django.http import JsonResponse
from supabase import create_client, Client
from .forms import CustomUserCreationForm
from supabase_auth._sync.gotrue_client import AuthApiError

# Initialize Supabase client
SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def register_view(request):
    if request.method == "POST" and request.headers.get("X-Requested-With") == "XMLHttpRequest":
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            try:
                response = supabase.auth.sign_up({
                    "email": data["email"],
                    "password": data["password1"],
                })

                if not getattr(response, "user", None):
                    return JsonResponse({
                        "errors": {"general": [{"message": "Registration failed. Please try again."}]}
                    }, status=400)

                user_id = response.user.id

                insert = supabase.table("user").insert({
                    "id": user_id,
                    "email": data["email"],
                    "first_name": data["first_name"],
                    "last_name": data["last_name"],
                    "birthday": data.get("birthday").isoformat() if data.get("birthday") else None,
                    "phone_number": data.get("phone_number"),
                    "college_dept": data.get("college_dept"),
                    "course": data.get("course"),
                    "year_level": data.get("year_level"),
                }).execute()

                if getattr(insert, "error", None):
                    try:
                        supabase.auth.admin.delete_user(user_id)
                    except Exception:
                        pass

                    err_msg = "Registration failed. Please try again."
                    try:
                        if hasattr(insert.error, "message"):
                            err_msg = insert.error.message
                        elif isinstance(insert.error, dict) and insert.error.get("message"):
                            err_msg = insert.error.get("message")
                    except Exception:
                        pass

                    return JsonResponse({
                        "errors": {"general": [{"message": err_msg}]}
                    }, status=400)

                return JsonResponse({"success": True, "redirect_url": "/login"})

            except AuthApiError as e:
                err_msg = "Email is already registered."
                try:
                    e_data = e.args[0]
                    if isinstance(e_data, dict) and e_data.get("msg"):
                        err_msg = e_data["msg"]
                except Exception:
                    pass
                return JsonResponse({"errors": {"general": [{"message": err_msg}]}}, status=400)

            except Exception as e:
                err_msg = "Unexpected server error. Please try again."
                try:
                    if isinstance(e, dict) and e.get("message"):
                        err_msg = e["message"]
                    elif hasattr(e, "args") and e.args:
                        first_arg = e.args[0]
                        if isinstance(first_arg, dict) and first_arg.get("message"):
                            err_msg = first_arg["message"]
                except Exception:
                    pass
                print("Unexpected server error in register_view:", e)
                return JsonResponse({
                    "errors": {"general": [{"message": err_msg}]}
                }, status=500)

        else:
            errors = {field: [{"message": err} for err in errs] for field, errs in form.errors.items()}
            return JsonResponse({"errors": errors}, status=400)

    form = CustomUserCreationForm()
    return render(request, "login-register/register.html", {"form": form})

 
def login_view(request):
    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")

        try:
            response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })

            if response.user:
                request.session["supabase_user_id"] = response.user.id
                messages.success(request, "Welcome back!")
                return redirect("home")
            else:
                return render(request, "login-register/login.html", {
                    "errors": {"invalid": [{"message": "Invalid credentials"}]}
                })

        except AuthApiError as e:
            error_msg = "Invalid credentials"
            try:
                err_data = e.args[0]
                if isinstance(err_data, dict) and err_data.get("msg"):
                    error_msg = err_data["msg"]
                elif isinstance(err_data, str):
                    error_msg = err_data
            except Exception:
                pass

            return render(request, "login-register/login.html", {
                "errors": {"email_not_confirmed": [{"message": error_msg}]}
            })

    return render(request, "login-register/login.html")


def logout_view(request):
    request.session.flush()
    messages.success(request, "Logged out successfully.")
    return redirect("login")


def home(request):
    user_id = request.session.get("supabase_user_id")
    if not user_id:
        return redirect("login")

    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp.data else None

    return render(request, "home.html", {"user_info": user_info})


def profile(request):
    user_id = request.session.get("supabase_user_id")
    if not user_id:
        return redirect("login")

    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp.data else {}

    try:
        auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
        if auth_user_resp.user and "email" not in user_info:
            user_info["email"] = auth_user_resp.user.email
    except Exception:
        pass

    return render(request, "profile.html", {"user_info": user_info})
 

 
def login_view(request):
    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")

        try:
            response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })

            if response.user:
                request.session["supabase_user_id"] = response.user.id
                messages.success(request, "Welcome back!")
                return redirect("home")
            else:
                return render(request, "login-register/login.html", {
                    "errors": {"invalid": [{"message": "Invalid credentials"}]}
                })

        except AuthApiError as e:
            error_msg = "Invalid credentials"
            try:
                err_data = e.args[0]
                if isinstance(err_data, dict) and err_data.get("msg"):
                    error_msg = err_data["msg"]
                elif isinstance(err_data, str):
                    error_msg = err_data
            except Exception:
                pass

            return render(request, "login-register/login.html", {
                "errors": {"email_not_confirmed": [{"message": error_msg}]}
            })

    return render(request, "login-register/login.html")


def logout_view(request):
    request.session.flush()
    messages.success(request, "Logged out successfully.")
    return redirect("login")


def home(request):
    user_id = request.session.get("supabase_user_id")
    if not user_id:
        return redirect("login")

    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp.data else None

    return render(request, "home.html", {"user_info": user_info})


def profile(request):
    user_id = request.session.get("supabase_user_id")
    if not user_id:
        return redirect("login")

    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp.data else {}


    try:
        auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
        if auth_user_resp.user and "email" not in user_info:
            user_info["email"] = auth_user_resp.user.email
    except Exception:
        pass

    return render(request, "profile.html", {"user_info": user_info})
 