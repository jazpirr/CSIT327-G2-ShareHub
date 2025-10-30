# views.py
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import logout
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
 
from supabase import create_client, Client
from supabase_auth._sync.gotrue_client import AuthApiError
 
from .forms import CustomUserCreationForm
from .utils import supabase_login_required
 
import os
import uuid
import json
import re
from django.views.decorators.http import require_POST
from supabase import create_client as create_supabase_client
 
SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY
SUPABASE_SERVICE_ROLE_KEY = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

EMAIL_REGEX = re.compile(r"[^@]+@[^@]+\.[^@]+")

 
 
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
                request.session["user_email"] = email
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
    logout(request)
    return redirect('/login/?logout_success=1')

def custom_logout(request):
    logout(request)
    return redirect('/login?logout_success=1')
    
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
    import logging
    logger = logging.getLogger(__name__)

    user_id = request.session.get("supabase_user_id")

    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp.data else None

    available_items = []
    try:
        items_resp = supabase.table("item") \
            .select("*") \
            .eq("available", True) \
            .neq("user_id", user_id) \
            .execute()

        logger.info("Supabase items_resp: %s", getattr(items_resp, "__dict__", str(items_resp)))
        if getattr(items_resp, "error", None):
            logger.error("Supabase error: %s", items_resp.error)
        else:
            available_items = items_resp.data or []
            logger.info("Found %d available items (excluding current user)", len(available_items))

        if not available_items:
            logger.info("No items after excluding current user. Trying without excluding user...")
            test_resp = supabase.table("item").select("*").eq("available", True).execute()
            logger.info("Supabase test_resp: %s", getattr(test_resp, "__dict__", str(test_resp)))
            if getattr(test_resp, "error", None):
                logger.error("Supabase test query error: %s", test_resp.error)
            else:
                logger.info("Found %d available items (including all users)", len(test_resp.data or []))

    except Exception as e:
        logger.exception("Exception fetching available items: %s", e)

    return render(request, "home.html", {
        "user_info": user_info,
        "available_items": available_items,
    })


 
 
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


#change email and password in settings page

@require_POST
def update_email(request):
    """Update user's email with detailed logging"""
    user_id = request.session.get('supabase_user_id')
    if not user_id:
        return JsonResponse({'errors': {'general': [{'message': 'Not authenticated'}]}}, status=401)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except:
        payload = {}

    current_password = payload.get('current_password') or request.POST.get('current_password')
    new_email = payload.get('new_email') or request.POST.get('new_email')

    if not current_password:
        return JsonResponse({'errors': {'current_password': [{'message': 'Current password required'}]}}, status=400)
    
    if not new_email or not EMAIL_REGEX.match(new_email):
        return JsonResponse({'errors': {'email': [{'message': 'Invalid email'}]}}, status=400)

    current_email = request.session.get('user_email')
    
    if not current_email:
        try:
            user_data = supabase.table('user').select('email').eq('id', user_id).execute()
            if user_data.data and len(user_data.data) > 0:
                current_email = user_data.data[0].get('email')
        except:
            pass
    
    if not current_email:
        return JsonResponse({'errors': {'general': [{'message': 'Unable to determine current email'}]}}, status=400)

    print(f'🔍 DEBUG: Current email: {current_email}, New email: {new_email}')

    try:
        signin_resp = supabase.auth.sign_in_with_password({'email': current_email, 'password': current_password})
        user_obj = getattr(signin_resp, 'user', None)
        session_obj = getattr(signin_resp, 'session', None)
        
        if not user_obj or not session_obj:
            print('❌ DEBUG: Sign-in failed')
            return JsonResponse({'errors': {'current_password': [{'message': 'Invalid password'}]}}, status=400)
        
        access_token = session_obj.access_token
        refresh_token = session_obj.refresh_token
        print(f'✅ DEBUG: Sign-in successful! User ID: {user_obj.id}')
        
    except Exception as e:
        print(f'❌ Sign-in error: {e}')
        return JsonResponse({'errors': {'current_password': [{'message': 'Invalid password'}]}}, status=400)

    try:
        from supabase import create_client
        user_supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        user_supabase.auth.set_session(access_token, refresh_token)
        
        print(f'🔄 DEBUG: Calling update_user with email: {new_email}')
        update_resp = user_supabase.auth.update_user({'email': new_email})
        
        if hasattr(update_resp, 'error') and update_resp.error:
            print(f'❌ Email update error: {update_resp.error}')
            return JsonResponse({'errors': {'general': [{'message': 'Failed to update email'}]}}, status=400)
        
        updated_user = getattr(update_resp, 'user', None)
        if updated_user:
            print(f'✅ DEBUG: Supabase Auth returned updated user. Email in response: {getattr(updated_user, "email", "NOT FOUND")}')
            print(f'✅ DEBUG: User confirmed: {getattr(updated_user, "email_confirmed_at", "NOT CONFIRMED")}')
        else:
            print(f'⚠️ WARNING: No user object in update response!')
        
        try:
            supabase.table('user').update({'email': new_email}).eq('id', user_id).execute()
            print(f'✅ DEBUG: User table updated')
        except Exception as e:
            print(f'⚠️ Table sync warning: {e}')
        
    
        request.session['user_email'] = new_email
        
        print(f'✅ Email update complete for user {user_id}')
        return JsonResponse({
            'success': True, 
            'message': 'Email updated! Please check your new email inbox for a confirmation link if required.'
        })
        
    except Exception as e:
        print(f'❌ Email update exception: {type(e).__name__}: {str(e)}')
        import traceback
        traceback.print_exc()
        return JsonResponse({'errors': {'general': [{'message': str(e)}]}}, status=400)



@require_POST
def update_password(request):
    """Update password"""
    user_id = request.session.get('supabase_user_id')
    if not user_id:
        return JsonResponse({'errors': {'general': [{'message': 'Not authenticated'}]}}, status=401)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except:
        payload = {}

    current_password = payload.get('current_password') or request.POST.get('current_password')
    new_password = payload.get('new_password') or request.POST.get('new_password')

    if not current_password:
        return JsonResponse({'errors': {'current_password': [{'message': 'Current password required'}]}}, status=400)
    
    if not new_password or len(new_password) < 8:
        return JsonResponse({'errors': {'new_password': [{'message': 'Min 8 characters'}]}}, status=400)

    current_email = request.session.get('user_email')
    
    if not current_email:
        try:
            user_data = supabase.table('user').select('email').eq('id', user_id).execute()
            if user_data.data and len(user_data.data) > 0:
                current_email = user_data.data[0].get('email')
        except:
            pass
    
    if not current_email:
        return JsonResponse({'errors': {'general': [{'message': 'Unable to determine current email'}]}}, status=400)

    print(f'DEBUG: Attempting sign-in with email: {current_email}')

    try:
        signin_resp = supabase.auth.sign_in_with_password({'email': current_email, 'password': current_password})
        user_obj = getattr(signin_resp, 'user', None)
        session_obj = getattr(signin_resp, 'session', None)
        
        if not user_obj or not session_obj:
            print('DEBUG: Sign-in failed')
            return JsonResponse({'errors': {'current_password': [{'message': 'Invalid password'}]}}, status=400)
        
        access_token = session_obj.access_token
        refresh_token = session_obj.refresh_token
        print('DEBUG: Sign-in successful!')
        
    except Exception as e:
        print(f'Sign-in error: {e}')
        return JsonResponse({'errors': {'current_password': [{'message': 'Invalid password'}]}}, status=400)

  
    try:
        from supabase import create_client
        user_supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        user_supabase.auth.set_session(access_token, refresh_token)
        update_resp = user_supabase.auth.update_user({'password': new_password})
        
        if hasattr(update_resp, 'error') and update_resp.error:
            print(f'Password update error: {update_resp.error}')
            return JsonResponse({'errors': {'general': [{'message': 'Failed to update password'}]}}, status=400)
        
        print(f'✅ Password updated successfully for user {user_id}')
        return JsonResponse({'success': True, 'message': 'Password updated successfully!'})
        
    except Exception as e:
        print(f'❌ Password update exception: {e}')
        return JsonResponse({'errors': {'general': [{'message': str(e)}]}}, status=400)


#end of change email and password in settings page


def admin_dashboard (request):
  return render(request, "admindashboard.html")

@require_POST
def forgot_password(request):
    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        payload = {}
    email = (payload.get("email") or request.POST.get("email") or "").strip()

    if not email or not EMAIL_REGEX.match(email):
        return JsonResponse({"errors": {"email": [{"message": "Enter a valid email address"}]}}, status=400)

    redirect_to = getattr(settings, "SUPABASE_RESET_REDIRECT", None) or "http://127.0.0.1:8000/reset-password"

    try:
        supabase.auth.reset_password_for_email(email, {"redirect_to": redirect_to})
        return JsonResponse({"success": True, "message": "A reset link has been sent to your email."})
    except AuthApiError as e:
        # Show the real error while DEBUG is True; otherwise keep it generic to avoid user enumeration
        if getattr(settings, "DEBUG", False):
            detail = None
            try:
                data = e.args[0]
                if isinstance(data, dict) and data.get("msg"):
                    detail = data["msg"]
                elif isinstance(data, str):
                    detail = data
            except Exception:
                pass
            return JsonResponse({"errors": {"supabase": [{"message": detail or "Auth error"}]}}, status=400)
        return JsonResponse({"success": True, "message": "A reset link has been sent to your email."})
    except Exception as e:
        print("Forgot password error:", repr(e))
        return JsonResponse({"errors": {"general": [{"message": "Something went wrong. Please try again."}]}}, status=400)


def reset_password_page(request):
    return render(
        request,
        "login-register/reset_password.html",
        {
            "SUPABASE_URL": settings.SUPABASE_URL,
            "SUPABASE_ANON_KEY": settings.SUPABASE_ANON_KEY,
            "LOGIN_URL": "/login/", 
        }, 
    )

@require_POST
@supabase_login_required
def add_item(request):
    import logging
    logger = logging.getLogger(__name__)

    logger.info("🟢 [add_item] hit")
    user_id = request.session.get("supabase_user_id")
    logger.info("   session user_id: %s", user_id)
    if not user_id:
        return JsonResponse({"errors": {"general": [{"message": "Not authenticated"}]}}, status=401)

    title = (request.POST.get("itemName") or request.POST.get("title") or "").strip()
    category = (request.POST.get("category") or request.POST.get("itemCategory") or "").strip()
    condition = (request.POST.get("condition") or request.POST.get("itemCondition") or "").strip()
    description = (request.POST.get("description") or request.POST.get("itemDescription") or "").strip()

    availability_raw = (request.POST.get("availability") or request.POST.get("available") or "available").strip().lower()

    if not title or not category or not condition or not description:
        return JsonResponse({"errors": {"general": [{"message": "Please fill in all required fields"}]}}, status=400)

    availability_bool = availability_raw in ("available", "true", "1", "on", "yes")

    file = request.FILES.get("image") or request.FILES.get("itemImage")
    image_url = None

    if not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("Missing SUPABASE_SERVICE_ROLE_KEY")
        return JsonResponse({"errors": {"general": [{"message": "Server misconfigured: missing service role key"}]}}, status=500)

    admin_client = create_supabase_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    try:
        if file:
            ext = os.path.splitext(file.name)[1] or ".bin"
            filename = f"{user_id}/{uuid.uuid4()}{ext}"
            file_bytes = file.read()

            upload_res = admin_client.storage.from_("item-images").upload(filename, file_bytes)
            if getattr(upload_res, "error", None):
                err = upload_res.error
                msg = getattr(err, "message", str(err))
                logger.error("Upload error: %s", msg)
                return JsonResponse({"errors": {"image": [{"message": f"Failed to upload image: {msg}"}]}}, status=500)

            public = admin_client.storage.from_("item-images").get_public_url(filename)
            image_url = (public.get("publicUrl") if isinstance(public, dict) and public.get("publicUrl") else
                         getattr(public, "public_url", None) or getattr(public, "publicUrl", None) or (public if isinstance(public, str) else None))
            logger.info("   image_url=%s", image_url)
    except Exception as e:
        logger.exception("Image upload exception")
        return JsonResponse({"errors": {"image": [{"message": f"Image upload error: {str(e)}"}]}}, status=500)

    try:
        item_id = str(uuid.uuid4())
        payload = {
            "item_id": item_id,
            "title": title,
            "description": description,
            "category": category,
            "user_id": user_id,
            "condition": condition,
            "available": availability_bool,
            "image_url": image_url,
        }

        logger.debug("INSERT payload: %s", payload)
        insert_res = admin_client.table("item").insert(payload).execute()

        if getattr(insert_res, "error", None):
            err = insert_res.error
            msg = getattr(err, "message", str(err))
            logger.error("Insert error: %s", msg)
            return JsonResponse({"errors": {"general": [{"message": f"Failed to create item: {msg}"}]}}, status=500)

        logger.info("✅ [add_item] success item_id=%s", item_id)
        return JsonResponse({"success": True, "item_id": item_id})
    except Exception as e:
        logger.exception("Insert exception")
        return JsonResponse({"errors": {"general": [{"message": str(e)}]}}, status=500)

