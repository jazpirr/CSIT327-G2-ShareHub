from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
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
from datetime import datetime, timezone, timedelta
import logging
 
import os
import uuid
import json
import re
from django.views.decorators.http import require_POST
from supabase import create_client as create_supabase_client
from django.views.decorators.csrf import csrf_exempt
from django.utils.http import url_has_allowed_host_and_scheme
from supabase_auth._sync.gotrue_client import AuthApiError
from functools import wraps
from django.http import HttpResponseForbidden


SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY
SUPABASE_SERVICE_ROLE_KEY = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
SUPABASE_ANON_KEY = getattr(settings, "SUPABASE_ANON_KEY", None)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) 

EMAIL_REGEX = re.compile(r"[^@]+@[^@]+\.[^@]+")

@login_required
def settings_view(request):
   
    user_settings, created = UserSettings.objects.get_or_create(user=request.user)

    if request.method == "POST":
        user_settings.show_email = "show_email" in request.POST
        user_settings.show_profile = "show_profile" in request.POST
        user_settings.allow_sharing = "allow_sharing" in request.POST
        user_settings.profile_visibility = "profile_visibility" in request.POST
        user_settings.contact_information = "contact_information" in request.POST
        user_settings.save()
        return redirect("settings") 

    return render(request, "settings.html", {"user_settings": user_settings})
 
 
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
 
def admin_required(view_func):
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        
        if request.session.get("is_admin"):
            return view_func(request, *args, **kwargs)

       
        user_id = request.session.get("supabase_user_id")
        if not user_id:
            return HttpResponseForbidden("Not authenticated")

        try:
            resp = supabase.table("user").select("is_admin").eq("id", user_id).maybe_single().execute()
            if getattr(resp, "data", None) and resp.data.get("is_admin"):
                request.session["is_admin"] = True
                return view_func(request, *args, **kwargs)
        except Exception:
            pass

        return HttpResponseForbidden("Admin only")
    return _wrapped


@never_cache
def login_view(request):
    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")
        raw_next = request.POST.get("next") or request.GET.get("next") or ""

        try:
            response = supabase.auth.sign_in_with_password({"email": email, "password": password})
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


        if not getattr(response, "user", None):
            return render(request, "login-register/login.html", {
                "errors": {"invalid": [{"message": "Invalid credentials"}]}
            })

 
        user_id = response.user.id
        request.session["supabase_user_id"] = user_id
        request.session["user_email"] = email

  
        is_admin = False
        try:
            uresp = supabase.table("user").select("is_admin").eq("id", user_id).maybe_single().execute()
            if getattr(uresp, "data", None):
                is_admin = bool(uresp.data.get("is_admin"))
        except Exception:
        
            is_admin = False

        request.session["is_admin"] = bool(is_admin)


        if raw_next and url_has_allowed_host_and_scheme(raw_next, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
            return redirect(raw_next)


        if is_admin:
            messages.success(request, "Welcome, admin!")
            return redirect("admin_dashboard")
        else:
            messages.success(request, "Welcome back!")
            return redirect("home")

    resp = render(request, "login-register/login.html", {"next": request.GET.get("next", "")})
    resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp["Pragma"] = "no-cache"
    resp["Expires"] = "0"
    return resp


# ---------- Logout ----------
@never_cache
def logout_view(request):
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

    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp and getattr(profile_resp, "data", None) else None

    # ALWAYS get email from Supabase Auth (source of truth)
    if user_info:
        try:
            auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
            if auth_user_resp.user:
                user_info["email"] = auth_user_resp.user.email
                request.session['user_email'] = auth_user_resp.user.email
        except Exception as e:
            print(f"Error fetching auth email: {e}")
            if request.session.get('user_email'):
                user_info["email"] = request.session.get('user_email')

    notifications, unread_count = fetch_notifications_for(user_id)


    incoming_requests = []
    try:
        items_resp = supabase.table('item').select('item_id,title').eq('user_id', user_id).execute()
        my_items = items_resp.data or []
        my_item_ids = [it.get('item_id') for it in my_items if it.get('item_id')]

        if my_item_ids:
            req_resp = supabase.table('request') \
                        .select('request_id,item_id,user_id,request_date,status') \
                        .in_('item_id', my_item_ids) \
                        .eq('status', 'pending') \
                        .order('request_date', desc=True) \
                        .execute()
            incoming_requests = req_resp.data or []

            req_user_ids = list({r.get('user_id') for r in incoming_requests if r.get('user_id')})
            users_map = {}
            if req_user_ids:
                uresp = supabase.table('user').select('id,first_name,last_name,email').in_('id', req_user_ids).execute()
                for u in (uresp.data or []):
                    display = ((u.get('first_name') or '') + ' ' + (u.get('last_name') or '')).strip()
                    if not display:
                        display = u.get('email') or u.get('id')
                    users_map[u.get('id')] = display

            items_map = {it.get('item_id'): it.get('title') for it in (my_items or [])}
            for r in incoming_requests:
                r['requester_name'] = users_map.get(r.get('user_id'), r.get('user_id'))
                r['item_title'] = items_map.get(r.get('item_id'), r.get('item_id'))
                rd = r.get('request_date')
                try:
                    r_dt = datetime.fromisoformat(rd) if isinstance(rd, str) else rd
                    r['request_date_human'] = r_dt.strftime("%Y-%m-%d %H:%M") if r_dt else rd
                except Exception:
                    r['request_date_human'] = rd or ''
    except Exception:
        incoming_requests = []

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
        itm['owner_id'] = owner_id


    borrowed_items = []
    try:
        br_req_resp = supabase.table('request') \
              .select('request_id,item_id,user_id,request_date,return_date,status,return') \
              .eq('user_id', user_id) \
              .eq('status', 'approved') \
              .neq('return', True) \
              .order('request_date', desc=True) \
              .execute()
        br_reqs = br_req_resp.data or []

        if br_reqs:
            item_ids = [r.get('item_id') for r in br_reqs if r.get('item_id')]
            items_map = {}
            if item_ids:
                items_resp2 = supabase.table('item').select('item_id,title,user_id,image_url,description').in_('item_id', item_ids).execute()
                for it in (items_resp2.data or []):
                    items_map[it.get('item_id')] = it

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

            for r in br_reqs:
                itm = items_map.get(r.get('item_id')) or {}
                rd = r.get('return_date') or r.get('request_date')
                try:
                    r_dt = datetime.fromisoformat(rd) if isinstance(rd, str) else rd
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
                    "item_description": itm.get('description') or '',
                    "borrow_date": r.get('request_date'),
                    "return_date": r.get('return_date'),
                    "return_date_human": return_date_human,
                    "status": r.get('status')
                })
    except Exception:
        borrowed_items = []


    overdue_items = []
    overdue_count = 0
    try:
        now_utc = datetime.now(timezone.utc)
        for b in borrowed_items:
            rd = b.get("return_date")
            if not rd:
                continue
            try:
                if isinstance(rd, str):
                    parsed = datetime.fromisoformat(rd)
                else:
                    parsed = rd

                if parsed.tzinfo is None:
                    parsed_utc = parsed.replace(tzinfo=timezone.utc)
                else:
                    parsed_utc = parsed.astimezone(timezone.utc)

                if parsed_utc < now_utc:
                    overdue_items.append(b)
            except Exception:
                continue
        overdue_count = len(overdue_items)
    except Exception:
        overdue_items = []
        overdue_count = 0


    return render(request, "home.html", {
        "user_info": user_info,
        "available_items": available_items,
        "show_more": show_more,
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_ANON_KEY": settings.SUPABASE_ANON_KEY,
        "incoming_requests": incoming_requests,
        "borrowed_items": borrowed_items,
        "notifications": notifications,
        "overdue_items": overdue_items,
        "overdue_count": overdue_count,
        "unread_count": unread_count,
    })
 
 
@supabase_login_required
def profile(request):
    user_id = request.session.get("supabase_user_id")
    
    # Fetch from database
    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp.data else {}

    # ALWAYS get email from Supabase Auth (source of truth)
    try:
        auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
        if auth_user_resp.user:
            user_info["email"] = auth_user_resp.user.email
            request.session['user_email'] = auth_user_resp.user.email  # Update session too
    except Exception as e:
        print(f"Error fetching auth email: {e}")
        # Fallback to session
        if request.session.get('user_email'):
            user_info["email"] = request.session.get('user_email')

    # ... rest of your existing borrow_stats code ...
    borrow_stats = {
        "total_requests": 0,
        "total_borrowed": 0,
        "currently_borrowed": 0,
        "total_returned": 0,
        "overdue": 0,
        "months": [],
        "month_counts": [],
    }

    try:
        req_resp = supabase.table("request").select("*").eq("user_id", user_id).execute()
        reqs = req_resp.data or []
        borrow_stats["total_requests"] = len(reqs)

        now_utc = datetime.now(timezone.utc)

        months = []
        month_keys = []
        for i in range(5, -1, -1):
            m = (now_utc.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
            key = m.strftime("%Y-%m")
            months.append(m.strftime("%b %Y"))
            month_keys.append(key)

        counts = {k: 0 for k in month_keys}

        for r in reqs:
            status = (r.get("status") or "").lower()
            is_returned = bool(r.get("return") in (True, "True", "true", 1, "1"))
            if status == "approved":
                borrow_stats["total_borrowed"] += 1
                if not is_returned:
                    borrow_stats["currently_borrowed"] += 1
            if is_returned:
                borrow_stats["total_returned"] += 1

            if status == "approved" and not is_returned:
                rd = r.get("return_date")
                if rd:
                    try:
                        parsed = datetime.fromisoformat(rd) if isinstance(rd, str) else rd
                        if parsed.tzinfo is None:
                            parsed_utc = parsed.replace(tzinfo=timezone.utc)
                        else:
                            parsed_utc = parsed.astimezone(timezone.utc)
                        if parsed_utc < now_utc:
                            borrow_stats["overdue"] += 1
                    except Exception:
                        pass

            rd = r.get("request_date")
            if rd:
                try:
                    parsed = datetime.fromisoformat(rd) if isinstance(rd, str) else rd
                    if parsed.tzinfo is None:
                        parsed = parsed.replace(tzinfo=timezone.utc)
                    key = parsed.strftime("%Y-%m")
                    if key in counts:
                        counts[key] += 1
                except Exception:
                    pass

        month_values = [counts.get(k, 0) for k in month_keys]
        borrow_stats["months"] = months
        borrow_stats["month_counts"] = month_values

    except Exception:
        pass

    borrow_stats_json = json.dumps({
        "total_requests": borrow_stats["total_requests"],
        "total_borrowed": borrow_stats["total_borrowed"],
        "currently_borrowed": borrow_stats["currently_borrowed"],
        "total_returned": borrow_stats["total_returned"],
        "overdue": borrow_stats["overdue"],
        "months": borrow_stats["months"],
        "month_counts": borrow_stats["month_counts"],
    })

    notifications, unread_count = fetch_notifications_for(user_id)
    return render(request, "profile/profile.html", {
        "user_info": user_info,
        "notifications": notifications,
        "unread_count": unread_count,
        "borrow_stats_json": borrow_stats_json,
        "borrow_stats": borrow_stats,
    })


@supabase_login_required
def edit_profile(request):
    user_id = request.session.get("supabase_user_id")
 
    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data or {}
 
    # ALWAYS get email from Supabase Auth (source of truth)
    try:
        auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
        if auth_user_resp.user:
            user_info["email"] = auth_user_resp.user.email
            request.session['user_email'] = auth_user_resp.user.email
    except Exception as e:
        print(f"Error fetching auth email: {e}")
        if request.session.get('user_email'):
            user_info["email"] = request.session.get('user_email')
 
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
 
    # ... rest of your existing borrow_stats code ...
    borrow_stats = {
        "total_requests": 0,
        "total_borrowed": 0,
        "currently_borrowed": 0,
        "total_returned": 0,
        "overdue": 0,
        "months": [],
        "month_counts": [],
    }

    try:
        req_resp = supabase.table("request").select("*").eq("user_id", user_id).execute()
        reqs = req_resp.data or []
        borrow_stats["total_requests"] = len(reqs)

        now_utc = datetime.now(timezone.utc)

        months = []
        month_keys = []
        for i in range(5, -1, -1):
            m = (now_utc.replace(day=1) - timedelta(days=30*i)).replace(day=1)
            key = m.strftime("%Y-%m")
            months.append(m.strftime("%b %Y"))
            month_keys.append(key)

        counts = {k: 0 for k in month_keys}

        for r in reqs:
            status = (r.get("status") or "").lower()
            is_returned = bool(r.get("return") in (True, "True", "true", 1, "1"))
            if status == "approved":
                borrow_stats["total_borrowed"] += 1
                if not is_returned:
                    borrow_stats["currently_borrowed"] += 1
            if is_returned:
                borrow_stats["total_returned"] += 1

            if status == "approved" and not is_returned:
                rd = r.get("return_date")
                if rd:
                    try:
                        parsed = datetime.fromisoformat(rd) if isinstance(rd, str) else rd
                        if parsed.tzinfo is None:
                            parsed_utc = parsed.replace(tzinfo=timezone.utc)
                        else:
                            parsed_utc = parsed.astimezone(timezone.utc)
                        if parsed_utc < now_utc:
                            borrow_stats["overdue"] += 1
                    except Exception:
                        pass

            rd = r.get("request_date")
            if rd:
                try:
                    parsed = datetime.fromisoformat(rd) if isinstance(rd, str) else rd
                    if parsed.tzinfo is None:
                        parsed = parsed.replace(tzinfo=timezone.utc)
                    key = parsed.strftime("%Y-%m")
                    if key in counts:
                        counts[key] += 1
                except Exception:
                    pass

        borrow_stats["months"] = months
        borrow_stats["month_counts"] = [counts.get(k, 0) for k in month_keys]

    except Exception:
        pass

    borrow_stats_json = json.dumps({
        "total_requests": borrow_stats["total_requests"],
        "total_borrowed": borrow_stats["total_borrowed"],
        "currently_borrowed": borrow_stats["currently_borrowed"],
        "total_returned": borrow_stats["total_returned"],
        "overdue": borrow_stats["overdue"],
        "months": borrow_stats["months"],
        "month_counts": borrow_stats["month_counts"],
    })

    notifications, unread_count = fetch_notifications_for(user_id)

    return render(request, "profile/edit_profile.html", {
        "user_info": user_info,
        "notifications": notifications,
        "unread_count": unread_count,
        "borrow_stats_json": borrow_stats_json,
        "borrow_stats": borrow_stats,
    })
 
 
@supabase_login_required
def settings_view(request):
    user_id = request.session.get("supabase_user_id")
 
    profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
    user_info = profile_resp.data if profile_resp.data else {}
 
    # ALWAYS get email from Supabase Auth (source of truth)
    try:
        auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
        if auth_user_resp.user:
            user_info["email"] = auth_user_resp.user.email
            request.session['user_email'] = auth_user_resp.user.email
    except Exception as e:
        print(f"Error fetching auth email: {e}")
        if request.session.get('user_email'):
            user_info["email"] = request.session.get('user_email')
 
    return render(request, "settings.html", {"user_info": user_info})


@require_POST
def update_email(request):
    """Update user's email with proper sync"""
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

    # Step 1: Verify password
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

    # Step 2: Update Supabase Auth email
    try:
        from supabase import create_client
        user_supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        user_supabase.auth.set_session(access_token, refresh_token)
        
        print(f'🔄 DEBUG: Calling update_user with email: {new_email}')
        update_resp = user_supabase.auth.update_user({'email': new_email})
        
        if hasattr(update_resp, 'error') and update_resp.error:
            print(f'❌ Email update error: {update_resp.error}')
            return JsonResponse({'errors': {'general': [{'message': 'Failed to update email in auth'}]}}, status=400)
        
        updated_user = getattr(update_resp, 'user', None)
        if updated_user:
            print(f'✅ DEBUG: Auth email updated to: {getattr(updated_user, "email", "NOT FOUND")}')
        
    except Exception as e:
        print(f'❌ Email update exception: {type(e).__name__}: {str(e)}')
        return JsonResponse({'errors': {'general': [{'message': str(e)}]}}, status=400)

    # Step 3: Sync to user table using service role key for reliability
    try:
        if not SUPABASE_SERVICE_ROLE_KEY:
            print('⚠️ WARNING: No service role key, using regular key for table sync')
            sync_client = supabase
        else:
            sync_client = create_supabase_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        table_update = sync_client.table('user').update({'email': new_email}).eq('id', user_id).execute()
        
        if getattr(table_update, 'error', None):
            print(f'⚠️ Table sync error: {table_update.error}')
            # Don't fail the whole request, auth email is already updated
        else:
            print(f'✅ DEBUG: User table synced with new email')
            
    except Exception as e:
        print(f'⚠️ Table sync warning: {e}')
        # Continue - auth email is the source of truth

    # Step 4: Update session
    request.session['user_email'] = new_email
    request.session.modified = True
    
    print(f'✅ Email update complete for user {user_id}')
    return JsonResponse({
        'success': True, 
        'message': 'Email updated! Please check your new email inbox for a confirmation link if required.',
        'new_email': new_email
    })



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




@never_cache
@supabase_login_required
@admin_required
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
        insert_res = supabase.table("item").insert(payload).execute()

        if getattr(insert_res, "error", None):
            err = insert_res.error
            msg = getattr(err, "message", str(err))
            logger.error("Insert error: %s", msg)
            return JsonResponse({"errors": {"general": [{"message": f"Failed to create item: {msg}"}]}}, status=500)

        logger.info("✅ [add_item] success item_id=%s", item_id)
        return JsonResponse({
            "success": True,
            "item_id": item_id,
            "message": "Item added successfully!"
        })

    except Exception as e:
        logger.exception("Insert exception")
        return JsonResponse({
            "errors": {"general": [{"message": str(e)}]}},
            status=500
        )


@supabase_login_required
def borrow_items(request):
    """
    Render borrow_items.html with available_items including owner_display and owner_id
    """
    user_id = request.session.get("supabase_user_id")
    available_items = []

    try:
        items_resp = supabase.table("item").select("*").eq("available", True).neq("user_id", user_id).execute()
        if getattr(items_resp, "error", None):
            available_items = []
        else:
            available_items = items_resp.data or []
    except Exception:
        available_items = []


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

            for oid in owner_ids:
                try:
                    oresp = supabase.table("user").select("id,first_name,last_name,email").eq("id", oid).single().execute()
                    o = getattr(oresp, "data", None)
                    if o:
                        display = ( (o.get("first_name") or "") + " " + (o.get("last_name") or "") ).strip() or o.get("email") or o.get("id")
                        owner_map[oid] = display
                except Exception:
                    owner_map[oid] = str(oid)

    for itm in available_items:
        owner_id = itm.get("user_id") or itm.get("owner") or itm.get("user")
        itm["owner_display"] = owner_map.get(owner_id, "Unknown")
        itm["owner_id"] = owner_id

    # fetch notifications for current user to show in borrow_items header
    notifications, unread_count = fetch_notifications_for(user_id)

    return render(request, "borrow_items.html", {
        "available_items": available_items,
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY,
        "REQUEST_BORROW_URL": "/request-borrow/",
        "notifications": notifications,
        "unread_count": unread_count,
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
    end_date = payload.get('end_date') or request.POST.get('end_date')  

    if not item_id:
        return JsonResponse({'errors': {'item_id': [{'message': 'item_id required'}]}}, status=400)

    parsed_end = None

    if end_date:
        try:
            parsed_end = datetime.fromisoformat(end_date)

        except Exception:
            return JsonResponse({'errors': {'date': [{'message': 'Invalid date format. Use ISO date (YYYY-MM-DD) or full ISO.'}]}}, status=400)


        now = datetime.utcnow()
        try:
            if parsed_end.tzinfo is not None:
                parsed_end_utc = parsed_end.astimezone(timezone.utc).replace(tzinfo=None)
            else:
                parsed_end_utc = parsed_end
        except Exception:
            parsed_end_utc = parsed_end

        if parsed_end_utc <= now:
            return JsonResponse({'errors': {'date': [{'message': 'Return date must be in the future.'}]}}, status=400)


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

    req_id = str(uuid.uuid4())
    req_payload = {
        'request_id': req_id,
        'item_id': item_id,
        'user_id': user_id,
        'request_date': datetime.utcnow().isoformat(),
        'status': 'pending',
    }
    if parsed_end:
        req_payload['return_date'] = parsed_end.isoformat()

    try:
        insert_resp = supabase.table('request').insert(req_payload).execute()
        if getattr(insert_resp, 'error', None):
            return JsonResponse({'errors': {'general': [{'message': 'Failed to create request'}]}}, status=500)
    except Exception as e:
        return JsonResponse({'errors': {'general': [{'message': str(e)}]}}, status=500)

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


    rresp = supabase.table('request').select('*').eq('request_id', req_id).single().execute()
    if getattr(rresp, 'error', None) or not rresp.data:
        return JsonResponse({'errors': {'general': [{'message': 'Request not found'}]}}, status=404)

    req = rresp.data
    item_id = req.get('item_id')
    requester_id = req.get('user_id')
    current_status = (req.get('status') or '').lower()


    if current_status in ('approved', 'denied'):
        return JsonResponse({'success': False, 'status': current_status, 'message': 'Request already processed.'}, status=409)


    item_resp = supabase.table('item').select('item_id,title,user_id,available').eq('item_id', item_id).single().execute()
    if getattr(item_resp, 'error', None) or not item_resp.data:
        return JsonResponse({'errors': {'general': [{'message': 'Item not found'}]}}, status=404)
    item = item_resp.data


    if item.get('user_id') != user_id:
        return JsonResponse({'errors': {'general': [{'message': 'Permission denied'}]}}, status=403)

    new_status = 'approved' if action == 'approve' else 'denied'

    try:
        upd_resp = supabase.table('request').update({'status': new_status}).eq('request_id', req_id).execute()
        if getattr(upd_resp, 'error', None):
            return JsonResponse({'errors': {'general': [{'message': 'Failed to update request status'}]}}, status=500)
    except Exception:
        return JsonResponse({'errors': {'general': [{'message': 'Failed to update request status'}]}}, status=500)


    if new_status == 'approved':
        try:
            supabase.table('item').update({'available': False}).eq('item_id', item_id).execute()

        except Exception:
            pass


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

    return JsonResponse({
        'success': True,
        'status': new_status,
        'item_id': item_id,
        'requester_id': requester_id,
    })


@supabase_login_required
def return_items(request):
    """
    Page that lists all items the current user has borrowed (approved requests)
    and shows a history of items already marked as returned.
    """
    user_id = request.session.get("supabase_user_id")
    borrowed_items = []
    returned_items = [] 

    try:
        # --- 1. FETCH BORROWED (same as your working version) ---
        br_req_resp = supabase.table('request') \
              .select('request_id,item_id,user_id,request_date,return_date,status,return') \
              .eq('user_id', user_id) \
              .eq('status', 'approved') \
              .neq('return', True) \
              .order('request_date', desc=True) \
              .execute()
        br_reqs = br_req_resp.data or []

        if br_reqs:
            item_ids = [r.get('item_id') for r in br_reqs if r.get('item_id')]
            items_map = {}
            if item_ids:
                items_resp2 = supabase.table('item').select(
                    'item_id,title,user_id,image_url'
                ).in_('item_id', item_ids).execute()
                for it in (items_resp2.data or []):
                    items_map[it.get('item_id')] = it

            owner_ids = [
                (items_map.get(r.get('item_id')) or {}).get('user_id') for r in br_reqs
            ]
            owner_ids = [oid for oid in owner_ids if oid]

            owner_map = {}
            if owner_ids:
                try:
                    owners_resp = supabase.table('user').select(
                        'id,first_name,last_name,email'
                    ).in_('id', list(set(owner_ids))).execute()
                    if not getattr(owners_resp, 'error', None):
                        for o in (owners_resp.data or []):
                            display = (
                                ((o.get('first_name') or '') + ' ' + (o.get('last_name') or '')).strip()
                                or o.get('email')
                                or o.get('id')
                            )
                            owner_map[o.get('id')] = display
                except Exception:
                    for oid in owner_ids:
                        owner_map.setdefault(oid, str(oid))

            for r in br_reqs:
                itm = items_map.get(r.get('item_id')) or {}
                rd_request = r.get('request_date')
                try:
                    dt_req = datetime.fromisoformat(rd_request) if isinstance(rd_request, str) else rd_request
                    borrow_date_human = dt_req.strftime("%b %d, %Y")
                except Exception:
                    borrow_date_human = rd_request or ''

                rd_return = r.get('return_date')
                try:
                    if rd_return:
                        dt_ret = datetime.fromisoformat(rd_return) if isinstance(rd_return, str) else rd_return
                        return_date_human = dt_ret.strftime("%b %d, %Y")
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
                    "borrow_date_human": borrow_date_human,
                    "return_date_human": return_date_human,
                    "status": r.get('status'),
                })

        # --- 2. FETCH RETURNED ITEMS (fixed version without updated_at) ---
        ret_req_resp = supabase.table('request') \
            .select('request_id,item_id,user_id,request_date,return_date,status,return') \
            .eq('user_id', user_id) \
            .in_('return', [True, 'True', 'true']) \
            .order('return_date', desc=True) \
            .execute()
        ret_reqs = ret_req_resp.data or []

        if ret_reqs:
            item_ids = [r.get('item_id') for r in ret_reqs if r.get('item_id')]
            items_map = {}
            if item_ids:
                items_resp2 = supabase.table('item').select(
                    'item_id,title,image_url'
                ).in_('item_id', item_ids).execute()
                for it in (items_resp2.data or []):
                    items_map[it.get('item_id')] = it

            for r in ret_reqs:
                itm = items_map.get(r.get('item_id')) or {}
                rd_request = r.get('request_date')
                try:
                    dt_req = datetime.fromisoformat(rd_request) if isinstance(rd_request, str) else rd_request
                    borrow_date_human = dt_req.strftime("%b %d, %Y")
                except Exception:
                    borrow_date_human = rd_request or ''

                rd_return = r.get('return_date') or None
                try:
                    if rd_return:
                        dt_ret = datetime.fromisoformat(rd_return) if isinstance(rd_return, str) else rd_return
                        return_date_human = dt_ret.strftime("%b %d, %Y")
                    else:
                        return_date_human = ''
                except Exception:
                    return_date_human = rd_return or ''

                returned_items.append({
                    "request_id": r.get('request_id'),
                    "item_id": r.get('item_id'),
                    "item_title": itm.get('title') or r.get('item_id'),
                    "item_image": itm.get('image_url') or None,
                    "borrow_date_human": borrow_date_human,
                    "return_date_human": return_date_human,
                    "status": r.get('status'),
                })

    except Exception as e:
        print("Error in return_items:", e)
        borrowed_items = []
        returned_items = []

     # after your try/except and before final render:
    notifications, unread_count = fetch_notifications_for(user_id)

    return render(request, "return_items.html", {
        "borrowed_items": borrowed_items,
        "returned_items": returned_items,
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY,
        "notifications": notifications,
        "unread_count": unread_count,
    })


@csrf_exempt
def save_visibility(request):
    if request.method == "POST":
        data = json.loads(request.body)
        request.user.profile.is_public = data.get("is_public", False)
        request.user.profile.save()
        return JsonResponse({"status": "success"})

@csrf_exempt 
def save_contact(request):
    if request.method == "POST":
        data = json.loads(request.body)
        profile = request.user.profile
        profile.contact_email = data.get("email")
        profile.contact_phone = data.get("phone")
        profile.save()
        return JsonResponse({"status": "success"})

@require_POST
@supabase_login_required
def mark_notifications_read(request):
    user_id = request.session.get("supabase_user_id")
    if not user_id:
        return JsonResponse({"errors": {"general": [{"message": "Not authenticated"}]}}, status=401)

    try:
        upd = supabase.table("notification").update({"is_read": True}).eq("user_id", user_id).eq("is_read", False).execute()
        # supabase update may or may not return rows — best-effort
        updated_count = 0
        try:
            if getattr(upd, "data", None):
                updated_count = len(upd.data)
        except Exception:
            updated_count = 0
        return JsonResponse({"success": True, "updated": updated_count})
    except Exception as e:
        logging.getLogger(__name__).exception("Error marking notifications read: %s", e)
        return JsonResponse({"errors": {"general": [{"message": "Failed to mark notifications as read"}]}}, status=500)


@require_POST
@supabase_login_required
def mark_returned(request):
    user_id = request.session.get("supabase_user_id")
    payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    req_id = payload.get('request_id')

    if not req_id:
        return JsonResponse({'errors': {'general': [{'message': 'request_id required'}]}}, status=400)

    # Fetch the request row
    rresp = supabase.table('request').select('*').eq('request_id', req_id).single().execute()
    if getattr(rresp, 'error', None) or not rresp.data:
        return JsonResponse({'errors': {'general': [{'message': 'Request not found'}]}}, status=404)
    req = rresp.data

    # Verify that this request belongs to the current user
    if req.get('user_id') != user_id:
        return JsonResponse({'errors': {'general': [{'message': 'Permission denied'}]}}, status=403)

    try:
        # ✅ ONLY update the 'return' field (boolean), NOT 'status'
        supabase.table('request').update({'return': True}).eq('request_id', req_id).execute()

        # Optional: Add notification for the item owner
        try:
            item_id = req.get('item_id')
            item_resp = supabase.table('item').select('title,user_id').eq('item_id', item_id).maybe_single().execute()
            if getattr(item_resp, 'data', None):
                title = item_resp.data.get('title', 'an item')
                owner_id = item_resp.data.get('user_id')
                if owner_id:
                    notif_payload = {
                        'notification_id': str(uuid.uuid4()),
                        'user_id': owner_id,
                        'message': f"{request.session.get('user_email', 'Someone')} marked \"{title}\" as returned.",
                        'notif_type': 'return_notification',
                        'is_read': False,
                        'created_at': datetime.utcnow().isoformat(),
                    }
                    supabase.table('notification').insert(notif_payload).execute()
        except Exception:
            pass

    except Exception as e:
        print("Error updating return status:", e)
        return JsonResponse({'errors': {'general': [{'message': 'Failed to mark item as returned'}]}}, status=500)

    return JsonResponse({'success': True})


# ---------- helper to fetch notifications (reusable) ----------
def fetch_notifications_for(user_id, limit=10):
    """
    Returns (notifications_list, unread_count).
    Notifications will include a 'created_at_human' key for display.
    """
    if not user_id:
        return [], 0

    try:
        resp = supabase.table('notification') \
            .select('*') \
            .eq('user_id', user_id) \
            .order('created_at', desc=True) \
            .limit(limit) \
            .execute()
        notifications = resp.data or []

        for n in notifications:
            created = n.get('created_at')
            try:
                if isinstance(created, str):
                    dt = datetime.fromisoformat(created)
                    n['created_at_human'] = dt.strftime("%b %d, %Y • %I:%M %p")
                elif isinstance(created, datetime):
                    n['created_at_human'] = created.strftime("%b %d, %Y • %I:%M %p")
                else:
                    n['created_at_human'] = created or ''
            except Exception:
                n['created_at_human'] = created or ''

        unread_count = sum(1 for n in notifications if not n.get('is_read'))
        return notifications, unread_count
    except Exception:
        return [], 0

