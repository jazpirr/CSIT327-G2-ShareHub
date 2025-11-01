from django.shortcuts import render, redirect
from django.contrib import messages
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.urls import reverse
from django.contrib.auth import logout
   
from supabase import create_client, Client
from supabase_auth._sync.gotrue_client import AuthApiError
 
from .forms import CustomUserCreationForm
from .utils import supabase_login_required
from datetime import datetime
import logging
 
import os
import uuid
import json
import re
from django.views.decorators.http import require_POST
from supabase import create_client as create_supabase_client
 
SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY
SUPABASE_SERVICE_ROLE_KEY = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
SUPABASE_ANON_KEY = getattr(settings, "SUPABASE_ANON_KEY", None)
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
    # Clear the session
    request.session.flush()

    try:
        supabase.auth.sign_out()
    except Exception:
        pass
 
    resp = redirect(reverse("login") + "?logout_success=1")
    resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp["Pragma"] = "no-cache"
    resp["Expires"] = "0"
    return resp
   
 
@supabase_login_required
def home(request):

    logger = logging.getLogger(__name__)

    user_id = request.session.get("supabase_user_id")

    # Load basic user/profile
    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp and getattr(profile_resp, "data", None) else None

    # Load notifications (recent)
    try:
        notifs_resp = supabase.table('notification') \
            .select('*') \
            .eq('user_id', user_id) \
            .order('created_at', desc=True) \
            .limit(10) \
            .execute()
        notifications = notifs_resp.data or []
    except Exception:
        notifications = []

    # ---------- Incoming requests for items the current user owns (ONLY pending) ----------
    incoming_requests = []
    try:
        # get items owned by current user
        items_resp = supabase.table('item').select('item_id,title').eq('user_id', user_id).execute()
        my_items = items_resp.data or []
        my_item_ids = [it.get('item_id') for it in my_items if it.get('item_id')]

        if my_item_ids:
            # only pending requests for owner's UI
            req_resp = supabase.table('request') \
                        .select('request_id,item_id,user_id,request_date,status') \
                        .in_('item_id', my_item_ids) \
                        .eq('status', 'pending') \
                        .order('request_date', desc=True) \
                        .execute()
            incoming_requests = req_resp.data or []

            # fetch requester names in bulk
            req_user_ids = list({r.get('user_id') for r in incoming_requests if r.get('user_id')})
            users_map = {}
            if req_user_ids:
                uresp = supabase.table('user').select('id,first_name,last_name,email').in_('id', req_user_ids).execute()
                for u in (uresp.data or []):
                    display = ((u.get('first_name') or '') + ' ' + (u.get('last_name') or '')).strip()
                    if not display:
                        display = u.get('email') or u.get('id')
                    users_map[u.get('id')] = display

            # map item_id -> title for owner's items
            items_map = {it.get('item_id'): it.get('title') for it in (my_items or [])}
            # attach friendly fields
            for r in incoming_requests:
                r['requester_name'] = users_map.get(r.get('user_id'), r.get('user_id'))
                r['item_title'] = items_map.get(r.get('item_id'), r.get('item_id'))
                # keep raw request_date and a human string
                rd = r.get('request_date')
                try:
                    r_dt = datetime.fromisoformat(rd) if isinstance(rd, str) else rd
                    r['request_date_human'] = r_dt.strftime("%Y-%m-%d %H:%M") if r_dt else rd
                except Exception:
                    r['request_date_human'] = rd or ''
    except Exception:
        incoming_requests = []

    # ---------- Available items (the grid on the right) - reuse your existing logic ----------
    fetched_items = []
    try:
        try:
            items_resp = supabase.table("item") \
                .select("*") \
                .eq("available", True) \
                .neq("user_id", user_id) \
                .order("created_at", desc=True) \
                .limit(7) \
                .execute()
            if getattr(items_resp, "error", None):
                raise Exception("Ordered query error")
            fetched_items = items_resp.data or []
        except Exception as q_exc:
            # fallback: fetch all then sort
            items_resp = supabase.table("item").select("*").eq("available", True).neq("user_id", user_id).execute()
            fetched_items = items_resp.data or []
            def _sort_key(it):
                for k in ("created_at", "created", "inserted_at"):
                    v = it.get(k)
                    if v:
                        return v
                return it.get("item_id") or ""
            try:
                fetched_items = sorted(fetched_items, key=_sort_key, reverse=True)
            except Exception:
                pass
    except Exception as e:
        logger.exception("Exception fetching available items: %s", e)
        fetched_items = []

    show_more = len(fetched_items) > 6
    available_items = fetched_items[:6]

    for itm in available_items:
        raw = itm.get("created_at") or itm.get("created") or itm.get("inserted_at") or ""
        if isinstance(raw, datetime):
            iso = raw.isoformat()
            human = raw.strftime("%Y-%m-%d %H:%M")
        else:
            iso = str(raw) if raw else ""
            try:
                parsed = datetime.fromisoformat(iso)
                human = parsed.strftime("%Y-%m-%d %H:%M")
            except Exception:
                human = iso or ""
        itm["created_at_iso"] = iso
        itm["created_at_human"] = human

    # build owner_map quickly
    owner_ids = [itm.get('user_id') for itm in available_items if itm.get('user_id')]
    owner_map = {}
    if owner_ids:
        try:
            owner_list = list(set(owner_ids))
            owners_resp = supabase.table("user").select("id,first_name,last_name,email").in_("id", owner_list).execute()
            if not getattr(owners_resp, "error", None):
                for o in (owners_resp.data or []):
                    display = ((o.get('first_name') or '') + ' ' + (o.get('last_name') or '')).strip() or o.get('email') or o.get('id')
                    owner_map[o.get('id')] = display
        except Exception:
            for oid in owner_ids:
                if oid in owner_map:
                    continue
                try:
                    oresp = supabase.table('user').select('id,first_name,last_name,email').eq('id', oid).single().execute()
                    if getattr(oresp, 'error', None):
                        owner_map[oid] = str(oid)
                    else:
                        o = oresp.data or {}
                        display = ((o.get('first_name') or '') + ' ' + (o.get('last_name') or '')).strip() or o.get('email') or o.get('id') or str(oid)
                        owner_map[oid] = display
                except Exception:
                    owner_map[oid] = str(oid)

    for itm in available_items:
        owner_id = itm.get('user_id') or itm.get('owner') or itm.get('user')
        itm['owner_display'] = owner_map.get(owner_id, 'Unknown')

    # ---------- Borrowed items for CURRENT USER (approved requests made by this user) ----------
    borrowed_items = []
    try:
        # fetch approved requests where current user is the requester — include return_date
        br_req_resp = supabase.table('request') \
                      .select('request_id,item_id,user_id,request_date,return_date,status') \
                      .eq('user_id', user_id) \
                      .eq('status', 'approved') \
                      .order('request_date', desc=True) \
                      .execute()
        br_reqs = br_req_resp.data or []

        if br_reqs:
            item_ids = [r.get('item_id') for r in br_reqs if r.get('item_id')]
            items_map = {}
            if item_ids:
                items_resp2 = supabase.table('item').select('item_id,title,user_id,image_url').in_('item_id', item_ids).execute()
                for it in (items_resp2.data or []):
                    items_map[it.get('item_id')] = it

            # collect owner ids to fetch owner_display later
            owner_ids = [ (items_map.get(r.get('item_id')) or {}).get('user_id') for r in br_reqs ]
            owner_ids = [oid for oid in owner_ids if oid]

            # fetch owner names in bulk
            owner_map = {}
            if owner_ids:
                try:
                    owners_resp = supabase.table('user').select('id,first_name,last_name,email').in_('id', list(set(owner_ids))).execute()
                    if not getattr(owners_resp, 'error', None):
                        for o in (owners_resp.data or []):
                            display = ((o.get('first_name') or '') + ' ' + (o.get('last_name') or '')).strip() or o.get('email') or o.get('id')
                            owner_map[o.get('id')] = display
                except Exception:
                    for oid in owner_ids:
                        owner_map.setdefault(oid, str(oid))

            # Build borrowed_items using return_date when available (fall back to request_date)
            for r in br_reqs:
                itm = items_map.get(r.get('item_id')) or {}
                # prefer return_date for display; if missing show request_date
                rd = r.get('return_date') or r.get('request_date')
                try:
                    r_dt = datetime.fromisoformat(rd) if isinstance(rd, str) else rd
                    # choose desired human format, e.g. 'Oct 31, 2025 · 11:59 AM'
                    return_date_human = r_dt.strftime("%b %d, %Y · %I:%M %p") if r_dt else rd
                except Exception:
                    return_date_human = rd or ''

                borrowed_items.append({
                    "request_id": r.get('request_id'),
                    "item_id": r.get('item_id'),
                    "item_title": itm.get('title') or r.get('item_id'),
                    "owner_id": itm.get('user_id'),
                    "owner_display": owner_map.get(itm.get('user_id'), "Unknown"),
                    "item_image": itm.get('image_url') or None,
                    # borrow_date kept if you still want it; otherwise omit
                    "borrow_date": r.get('request_date'),
                    "return_date": r.get('return_date'),
                    "return_date_human": return_date_human,
                    "status": r.get('status')
                })
    except Exception:
        borrowed_items = []



    return render(request, "home.html", {
        "user_info": user_info,
        "available_items": available_items,
        "show_more": show_more,
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_ANON_KEY": settings.SUPABASE_ANON_KEY,
        "incoming_requests": incoming_requests,
        "borrowed_items": borrowed_items,
        "notifications": notifications,
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


@supabase_login_required
def borrow_items(request):
    """
    Render borrow_items.html with available_items including owner_display and owner_id
    """
    user_id = request.session.get("supabase_user_id")
    available_items = []

    try:
        # fetch items that are available and not owned by current user
        items_resp = supabase.table("item").select("*").eq("available", True).neq("user_id", user_id).execute()
        if getattr(items_resp, "error", None):
            # fallback to empty
            available_items = []
        else:
            available_items = items_resp.data or []
    except Exception:
        available_items = []

    # Build owner_map to avoid N queries
    owner_ids = {itm.get("user_id") for itm in available_items if itm.get("user_id")}
    owner_map = {}
    if owner_ids:
        try:
            owners_resp = supabase.table("user").select("id,first_name,last_name,email").in_("id", list(owner_ids)).execute()
            if not getattr(owners_resp, "error", None):
                for o in (owners_resp.data or []):
                    display = ( (o.get("first_name") or "") + " " + (o.get("last_name") or "") ).strip()
                    if not display:
                        display = o.get("email") or o.get("id")
                    owner_map[o.get("id")] = display
        except Exception:
            # fallback to individual lookups (optional)
            for oid in owner_ids:
                try:
                    oresp = supabase.table("user").select("id,first_name,last_name,email").eq("id", oid).single().execute()
                    o = getattr(oresp, "data", None)
                    if o:
                        display = ( (o.get("first_name") or "") + " " + (o.get("last_name") or "") ).strip() or o.get("email") or o.get("id")
                        owner_map[oid] = display
                except Exception:
                    owner_map[oid] = str(oid)

    # Attach display to items
    for itm in available_items:
        owner_id = itm.get("user_id") or itm.get("owner") or itm.get("user")
        itm["owner_display"] = owner_map.get(owner_id, "Unknown")
        # keep explicit owner id for JS to reference if needed
        itm["owner_id"] = owner_id

    return render(request, "borrow_items.html", {
        "available_items": available_items,
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY,
        # endpoint that the JS uses to send the create-request POST
        "REQUEST_BORROW_URL": "/request-borrow/",
    })


@require_POST
@supabase_login_required
def create_request(request):
    user_id = request.session.get('supabase_user_id')
    if not user_id:
        return JsonResponse({'errors': {'general': [{'message': 'Not authenticated'}]}}, status=401)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except Exception:
        payload = {}

    item_id = payload.get('item_id') or request.POST.get('item_id')
    end_date = payload.get('end_date') or request.POST.get('end_date')  # optional

    if not item_id:
        return JsonResponse({'errors': {'item_id': [{'message': 'item_id required'}]}}, status=400)

    # parse/validate end_date (if given) — we treat request_date (now) as the start
    parsed_end = None
    from datetime import datetime, timezone

    if end_date:
        try:
            # accept both 'YYYY-MM-DD' and full ISO
            parsed_end = datetime.fromisoformat(end_date)
            # normalize to UTC naive ISO if you prefer to store without tz:
            # parsed_end = parsed_end.astimezone(timezone.utc).replace(tzinfo=None)
        except Exception:
            return JsonResponse({'errors': {'date': [{'message': 'Invalid date format. Use ISO date (YYYY-MM-DD) or full ISO.'}]}}, status=400)

        # require return_date > now
        now = datetime.utcnow()
        # if parsed_end has tzinfo convert to naive UTC for comparison
        try:
            if parsed_end.tzinfo is not None:
                parsed_end_utc = parsed_end.astimezone(timezone.utc).replace(tzinfo=None)
            else:
                parsed_end_utc = parsed_end
        except Exception:
            parsed_end_utc = parsed_end

        if parsed_end_utc <= now:
            return JsonResponse({'errors': {'date': [{'message': 'Return date must be in the future.'}]}}, status=400)

    # fetch item to get owner and title
    try:
        item_resp = supabase.table('item').select('item_id,title,user_id').eq('item_id', item_id).single().execute()
        if getattr(item_resp, 'error', None) or not item_resp.data:
            return JsonResponse({'errors': {'general': [{'message': 'Item not found'}]}}, status=404)
        item = item_resp.data
    except Exception:
        return JsonResponse({'errors': {'general': [{'message': 'Failed to fetch item'}]}}, status=500)

    owner_id = item.get('user_id')
    if owner_id == user_id:
        return JsonResponse({'errors': {'general': [{'message': "You can't request your own item"}]}}, status=400)

    # create request row: request_date is 'now' (start), return_date stored only if provided
    req_id = str(uuid.uuid4())
    req_payload = {
        'request_id': req_id,
        'item_id': item_id,
        'user_id': user_id,
        'request_date': datetime.utcnow().isoformat(),
        'status': 'pending',
    }
    if parsed_end:
        # store as ISO string; DB column per your schema is `return_date`
        req_payload['return_date'] = parsed_end.isoformat()

    try:
        insert_resp = supabase.table('request').insert(req_payload).execute()
        if getattr(insert_resp, 'error', None):
            return JsonResponse({'errors': {'general': [{'message': 'Failed to create request'}]}}, status=500)
    except Exception as e:
        return JsonResponse({'errors': {'general': [{'message': str(e)}]}}, status=500)

    # create notification for owner
    try:
        message = f"{request.session.get('user_email','Someone')} requested your item \"{item.get('title','item')}\"."
        notif_payload = {
            'notification_id': str(uuid.uuid4()),
            'user_id': owner_id,
            'message': message,
            'notif_type': 'request',
            'is_read': False,
            'created_at': datetime.utcnow().isoformat(),
        }
        supabase.table('notification').insert(notif_payload).execute()
    except Exception:
        pass

    return JsonResponse({'success': True, 'request_id': req_id})




@require_POST 
@supabase_login_required
def respond_request(request):
    """
    Accepts JSON POST: { request_id, action } where action is 'approve' or 'deny'.
    Returns JSON: { success: True, status: 'approved'|'denied', item_id, requester_id }
    """
    user_id = request.session.get('supabase_user_id')
    if not user_id:
        return JsonResponse({'errors': {'general': [{'message': 'Not authenticated'}]}}, status=401)

    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except Exception:
        payload = {}

    req_id = payload.get('request_id') or request.POST.get('request_id')
    action = (payload.get('action') or request.POST.get('action') or '').lower()

    if not req_id or action not in ('approve', 'deny'):
        return JsonResponse({'errors': {'general': [{'message': 'Invalid parameters'}]}}, status=400)

    # load request
    rresp = supabase.table('request').select('*').eq('request_id', req_id).single().execute()
    if getattr(rresp, 'error', None) or not rresp.data:
        return JsonResponse({'errors': {'general': [{'message': 'Request not found'}]}}, status=404)

    req = rresp.data
    item_id = req.get('item_id')
    requester_id = req.get('user_id')
    current_status = (req.get('status') or '').lower()

    # If request already handled, short-circuit
    if current_status in ('approved', 'denied'):
        return JsonResponse({'success': False, 'status': current_status, 'message': 'Request already processed.'}, status=409)

    # load item and permission check
    item_resp = supabase.table('item').select('item_id,title,user_id,available').eq('item_id', item_id).single().execute()
    if getattr(item_resp, 'error', None) or not item_resp.data:
        return JsonResponse({'errors': {'general': [{'message': 'Item not found'}]}}, status=404)
    item = item_resp.data

    # Only owner can respond
    if item.get('user_id') != user_id:
        return JsonResponse({'errors': {'general': [{'message': 'Permission denied'}]}}, status=403)

    new_status = 'approved' if action == 'approve' else 'denied'

    # Update request row (set status)
    try:
        upd_resp = supabase.table('request').update({'status': new_status}).eq('request_id', req_id).execute()
        if getattr(upd_resp, 'error', None):
            return JsonResponse({'errors': {'general': [{'message': 'Failed to update request status'}]}}, status=500)
    except Exception:
        return JsonResponse({'errors': {'general': [{'message': 'Failed to update request status'}]}}, status=500)

    # If approved: mark item unavailable (transaction creation could go here)
    if new_status == 'approved':
        try:
            supabase.table('item').update({'available': False}).eq('item_id', item_id).execute()
            # Optional: create a transaction row to represent the borrow
            # tx_payload = {
            #     "transaction_id": str(uuid.uuid4()),
            #     "item_id": item_id,
            #     "owner_id": user_id,
            #     "borrower_id": requester_id,
            #     "request_id": req_id,
            #     "status": "active",
            #     "created_at": datetime.utcnow().isoformat(),
            # }
            # supabase.table('transaction').insert(tx_payload).execute()
        except Exception:
            # non-fatal; continue
            pass

    # Notify the requester
    try:
        msg = f'Your request for "{item.get("title")}" was {new_status}.'
        notif_payload = {
            'notification_id': str(uuid.uuid4()),
            'user_id': requester_id,
            'message': msg,
            'notif_type': f'request_{new_status}',
            'is_read': False,
            'created_at': datetime.utcnow().isoformat(),
        }
        supabase.table('notification').insert(notif_payload).execute()
    except Exception:
        pass

    # Return helpful JSON for the frontend
    return JsonResponse({
        'success': True,
        'status': new_status,
        'item_id': item_id,
        'requester_id': requester_id,
    })


@supabase_login_required
def return_items(request):
    """
    Page that lists all items the current user has borrowed (approved requests).
    """
    user_id = request.session.get("supabase_user_id")
    borrowed_items = []

    try:
        # fetch approved requests where current user is the requester — include return_date
        br_req_resp = supabase.table('request') \
                      .select('request_id,item_id,user_id,request_date,return_date,status') \
                      .eq('user_id', user_id) \
                      .eq('status', 'approved') \
                      .order('request_date', desc=True) \
                      .execute()
        br_reqs = br_req_resp.data or []

        if br_reqs:
            item_ids = [r.get('item_id') for r in br_reqs if r.get('item_id')]
            items_map = {}
            if item_ids:
                items_resp2 = supabase.table('item').select('item_id,title,user_id,image_url').in_('item_id', item_ids).execute()
                for it in (items_resp2.data or []):
                    items_map[it.get('item_id')] = it

            # collect owner ids to fetch owner_display later (owner = item.user_id)
            owner_ids = [ (items_map.get(r.get('item_id')) or {}).get('user_id') for r in br_reqs ]
            owner_ids = [oid for oid in owner_ids if oid]

            owner_map = {}
            if owner_ids:
                try:
                    owners_resp = supabase.table('user').select('id,first_name,last_name,email').in_('id', list(set(owner_ids))).execute()
                    if not getattr(owners_resp, 'error', None):
                        for o in (owners_resp.data or []):
                            display = ((o.get('first_name') or '') + ' ' + (o.get('last_name') or '')).strip() or o.get('email') or o.get('id')
                            owner_map[o.get('id')] = display
                except Exception:
                    for oid in owner_ids:
                        owner_map.setdefault(oid, str(oid))

            # Build borrowed_items list for template
            for r in br_reqs:
                itm = items_map.get(r.get('item_id')) or {}
                # human readable borrow/request date
                rd_request = r.get('request_date')
                try:
                    dt_req = datetime.fromisoformat(rd_request) if isinstance(rd_request, str) else rd_request
                    borrow_date_human = dt_req.strftime("%b %d, %Y") if dt_req else (rd_request or '')
                except Exception:
                    borrow_date_human = rd_request or ''

                # human readable return date (prefer return_date if present)
                rd_return = r.get('return_date') or None
                try:
                    if rd_return:
                        dt_ret = datetime.fromisoformat(rd_return) if isinstance(rd_return, str) else rd_return
                        return_date_human = dt_ret.strftime("%b %d, %Y") if dt_ret else (rd_return or '')
                    else:
                        return_date_human = ''
                except Exception:
                    return_date_human = rd_return or ''

                owner_id = itm.get('user_id')

                borrowed_items.append({
                    "request_id": r.get('request_id'),
                    "item_id": r.get('item_id'),
                    "item_title": itm.get('title') or r.get('item_id'),
                    "owner_id": owner_id,
                    "owner_display": owner_map.get(owner_id, "Unknown"),
                    "item_image": itm.get('image_url') or None,
                    "borrow_date": rd_request,
                    "borrow_date_human": borrow_date_human,
                    "return_date": rd_return,
                    "return_date_human": return_date_human,
                    "status": r.get('status'),
                })

    except Exception:
        borrowed_items = []

    return render(request, "return_items.html", {
        "borrowed_items": borrowed_items,
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY,
    })
