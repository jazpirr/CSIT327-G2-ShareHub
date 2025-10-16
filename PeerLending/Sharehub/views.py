from django.shortcuts import render, redirect
from django.contrib import messages
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
 
from supabase import create_client, Client
from supabase_auth._sync.gotrue_client import AuthApiError
 
from .forms import CustomUserCreationForm
from .utils import supabase_login_required
 
import os
import uuid
 
SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
 
 
@never_cache
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
        else:
            errors = {field: [{"message": err} for err in errs] for field, errs in form.errors.items()}
            return JsonResponse({"errors": errors}, status=400)
 
    resp = render(request, "login-register/register.html", {"form": CustomUserCreationForm()})
    resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp["Pragma"] = "no-cache"
    resp["Expires"] = "0"
    return resp
 
 
@never_cache
def login_view(request):
    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")
 
        try:
            response = supabase.auth.sign_in_with_password({"email": email, "password": password})
 
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
 
 
    resp = render(request, "login-register/login.html")
    resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp["Pragma"] = "no-cache"
    resp["Expires"] = "0"
    return resp
 
 
# ---------- Logout ----------
@never_cache
def logout_view(request):
    # Clear the session
    request.session.flush()
 
    try:
        supabase.auth.sign_out()
    except Exception:
        pass
 
    resp = redirect("login")
    resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp["Pragma"] = "no-cache"
    resp["Expires"] = "0"
    return resp
 
 
@supabase_login_required
def home(request):
    user_id = request.session.get("supabase_user_id")
    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp.data else None
    return render(request, "home.html", {"user_info": user_info})
 
 
@supabase_login_required
def profile(request):
    user_id = request.session.get("supabase_user_id")
    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp.data else {}
 
    try:
        auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
        if auth_user_resp.user and "email" not in user_info:
            user_info["email"] = auth_user_resp.user.email
    except Exception:
        pass
 
    return render(request, "profile/profile.html", {"user_info": user_info})
 
 
@supabase_login_required
def edit_profile(request):
    user_id = request.session.get("supabase_user_id")
 
   
    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data or {}
 
   
    try:
        auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
        if auth_user_resp.user:
            user_info["email"] = auth_user_resp.user.email
    except Exception:
        pass
 
    if request.method == "POST":
        first_name = request.POST.get("first_name")
        last_name = request.POST.get("last_name")
        birthday = request.POST.get("birthday") or None
        phone_number = request.POST.get("phone_number")
        college_dept = request.POST.get("college_dept")
        course = request.POST.get("course")
        year_level = request.POST.get("year_level")
 
        file = request.FILES.get("profile_picture")
        profile_picture_url = user_info.get("profile_picture")
 
        # Upload to Supabase Storage
        if file:
            ext = os.path.splitext(file.name)[1]
            file_name = f"{user_id}/{uuid.uuid4()}{ext}"
            file_bytes = file.read()
 
            upload_res = supabase.storage.from_("profile-pics").upload(file_name, file_bytes)
            if hasattr(upload_res, "error") and upload_res.error:
                messages.error(request, "Failed to upload image.")
            else:
                public_url = supabase.storage.from_("profile-pics").get_public_url(file_name)
                profile_picture_url = public_url
 
        update_response = supabase.table("user").update({
            "first_name": first_name,
            "last_name": last_name,
            "birthday": birthday,
            "phone_number": phone_number,
            "college_dept": college_dept,
            "course": course,
            "year_level": year_level,
            "profile_picture": profile_picture_url,
        }).eq("id", user_id).execute()
 
        if getattr(update_response, "error", None):
            messages.error(request, "Failed to update your profile.")
        else:
            messages.success(request, "Profile updated successfully!")
            return redirect("profile")
 
    return render(request, "profile/edit_profile.html", {"user_info": user_info})
 
 
@supabase_login_required
def settings_view(request):
    user_id = request.session.get("supabase_user_id")
 
    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp.data else {}
 
    try:
        auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
        if auth_user_resp.user and "email" not in user_info:
            user_info["email"] = auth_user_resp.user.email
    except Exception:
        pass
 
    return render(request, "settings.html", {"user_info": user_info})
 