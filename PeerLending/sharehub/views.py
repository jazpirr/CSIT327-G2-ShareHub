from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.urls import reverse
from django.contrib.auth import logout
from supabase import create_client   
from supabase import create_client, Client
from django.views.decorators.http import require_http_methods
from supabase_auth._sync.gotrue_client import AuthApiError
from django.views.decorators.http import require_GET
 
from .forms import CustomUserCreationForm
from .utils import supabase_login_required
from datetime import datetime, timedelta
from django.utils import timezone
import logging
from .utils import sync_user_to_orm
 
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

server_client = create_supabase_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

def ajax_require_auth(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        user_id = request.session.get("supabase_user_id") or getattr(request.user, "id", None)
        if not user_id:
            return JsonResponse({"success": False, "message": "Authentication required"}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper


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
            # convert year_level to int (or None) because the form ChoiceField returns a string
            year_val = data.get("year_level")
            try:
                year_val = int(year_val) if year_val not in (None, '') else None
            except (ValueError, TypeError):
                year_val = None

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

                insert_payload = {
                    "id": user_id,
                    "email": data["email"],
                    "first_name": data.get("first_name"),
                    "last_name": data.get("last_name"),
                    "birthday": data.get("birthday").isoformat() if data.get("birthday") else None,
                    "phone_number": data.get("phone_number"),
                    "college_dept": data.get("college_dept"),
                    "course": data.get("course"),
                    "year_level": year_val,
                }

                insert = supabase.table("user").insert(insert_payload).execute()

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
            print("REGISTER FORM INVALID:", form.errors.as_json())   # remove later
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

        # --- NEW: check is_block in your Supabase user row ---
        try:
            uresp = supabase.table("user").select("is_block").eq("id", user_id).maybe_single().execute()
            if getattr(uresp, "data", None) and uresp.data.get("is_block"):
                # immediately sign out the session, prevent login
                try:
                    supabase.auth.sign_out()
                except Exception:
                    pass
                # render with error
                return render(request, "login-register/login.html", {
                    "errors": {"blocked": [{"message": "Your account has been blocked. Contact an administrator."}]}
                })
        except Exception:
            # if anything goes wrong checking block status, fall through but you may prefer to block fail-safe
            pass
        # -----------------------------------------------

        # normal session setup
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


@require_POST
@supabase_login_required   # ensure only logged-in admin using your decorator
def toggle_block_user(request):
    import json
    data = json.loads(request.body.decode('utf-8') if request.body else '{}')
    user_id = data.get("user_id")
    if not user_id:
        return JsonResponse({"success": False, "error": "Missing user_id"}, status=400)

    # protect: admin can't block themselves
    current_user = request.session.get("supabase_user_id")
    if user_id == current_user:
        return JsonResponse({"success": False, "error": "You cannot block yourself."}, status=400)

    # update Supabase using service role
    if not SUPABASE_SERVICE_ROLE_KEY:
        return JsonResponse({"success": False, "error": "Server misconfigured"}, status=500)

    try:
        admin_client = create_supabase_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        # get current value
        resp = admin_client.table('user').select('is_block').eq('id', user_id).maybe_single().execute()
        current_block = False
        if getattr(resp, "data", None):
            current_block = bool(resp.data.get('is_block', False))

        new_block = not current_block
        upd = admin_client.table('user').update({'is_block': new_block}).eq('id', user_id).execute()
        if getattr(upd, "error", None):
            return JsonResponse({"success": False, "error": "Failed to update user"}, status=500)

        # optionally keep Django ORM in sync (if you have local CustomUser rows)
        try:
            user = CustomUser.objects.filter(id=user_id).first()
            if user:
                user.is_block = new_block
                user.save(update_fields=["is_block"])
        except Exception:
            pass

        return JsonResponse({"success": True, "is_block": new_block})
    except Exception as e:
        logging.getLogger(__name__).exception("toggle_block_user error: %s", e)
        return JsonResponse({"success": False, "error": "Exception updating user"}, status=500)






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

    
    # compute lent_out_count (items you own that are currently lent out)
    lent_out_count = 0
    try:
        # ensure we have my_item_ids (list of item_id strings)
        if 'my_item_ids' not in locals():
            items_resp = supabase.table('item').select('item_id').eq('user_id', user_id).execute()
            my_item_ids = [it.get('item_id') for it in (items_resp.data or [])]

        if my_item_ids:
            try:
                # Query active approved requests for your items
                reqs_resp = supabase.table('request') \
                    .select('request_id,item_id,status,return') \
                    .in_('item_id', my_item_ids) \
                    .eq('status', 'approved') \
                    .neq('return', True) \
                    .execute()

                lent_out_count = len(reqs_resp.data or [])
            except Exception:
                # Fallback: fetch all matching requests then filter in Python
                all_reqs_resp = supabase.table('request').select('request_id,item_id,status,return').in_('item_id', my_item_ids).execute()
                lent_out_count = sum(1 for r in (all_reqs_resp.data or []) if r.get('status') == 'approved' and not r.get('return'))
        else:
            lent_out_count = 0
    except Exception:
        lent_out_count = 0



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
        "lent_out_count": lent_out_count,
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
    """Update email without requiring URL configuration in Supabase"""
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

    # Step 1: Verify password
    try:
        signin_resp = supabase.auth.sign_in_with_password({
            'email': current_email, 
            'password': current_password
        })
        user_obj = getattr(signin_resp, 'user', None)
        session_obj = getattr(signin_resp, 'session', None)
        
        if not user_obj or not session_obj:
            return JsonResponse({'errors': {'current_password': [{'message': 'Invalid password'}]}}, status=400)
        
        access_token = session_obj.access_token
        refresh_token = session_obj.refresh_token
        
    except Exception as e:
        return JsonResponse({'errors': {'current_password': [{'message': 'Invalid password'}]}}, status=400)

    # Step 2: Update email in Supabase Auth (with service role - no email verification needed)
    try:
        sync_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        # ✅ KEY: Use admin API to update without verification
        update_resp = sync_client.auth.admin.update_user_by_id(
            user_id, 
            {"email": new_email, "email_confirm": True}  # Skip verification!
        )
        
        if hasattr(update_resp, 'error') and update_resp.error:
            return JsonResponse({'errors': {'general': [{'message': 'Failed to update email'}]}}, status=400)
        
        # Step 3: Update user table immediately
        try:
            table_update = sync_client.table('user').update({
                'email': new_email
            }).eq('id', user_id).execute()
        except Exception as sync_err:
            print(f'⚠️ Table sync warning: {sync_err}')
        
        # Step 4: Update session
        request.session['user_email'] = new_email
        request.session.modified = True
        
        return JsonResponse({
            'success': True,
            'message': 'Email updated successfully! You can now login with your new email.',
            'new_email': new_email
        })
        
    except Exception as e:
        print(f'❌ Email update error: {e}')
        return JsonResponse({'errors': {'general': [{'message': 'Failed to update email. Try again.'}]}}, status=400)


@never_cache
def confirm_email_change(request):
    """Handle email change confirmation from Supabase link"""
    try:
        # Get the token from URL
        access_token = request.GET.get('access_token')
        refresh_token = request.GET.get('refresh_token')
        token_type = request.GET.get('type')
        
        if token_type == 'email_change' and access_token:
            # Exchange the session
            from supabase import create_client
            temp_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            temp_client.auth.set_session(access_token, refresh_token)
            
            # Get updated user
            user_resp = temp_client.auth.get_user()
            updated_user = getattr(user_resp, 'user', None)
            
            if updated_user:
                new_email = updated_user.email
                user_id = updated_user.id
                
                # Update user table
                sync_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
                sync_client.table('user').update({'email': new_email}).eq('id', user_id).execute()
                
                # Update session
                request.session['user_email'] = new_email
                request.session['supabase_user_id'] = user_id
                request.session.modified = True
                
                messages.success(request, f'Email successfully changed to {new_email}!')
                return redirect('home')
        
        # If no valid token, just redirect to login
        messages.info(request, 'Please log in with your new email')
        return redirect('login')
        
    except Exception as e:
        print(f'❌ Email confirmation error: {e}')
        messages.error(request, 'Email confirmation failed. Please try again.')
        return redirect('login')


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
def admin_dashboard(request):
    """
    Fetch summaries from Supabase and render the admin dashboard.
    Provides:
      - total_users, total_items, available_items
      - active_requests, pending_requests
      - issues_count (derived), overdue_count
      - borrowing_chart and return_chart (JSON serializable dicts)
      - borrowed_items list (for table) and borrowed_items_json
    """
    now = datetime.utcnow()
    # safe supabase client (already configured at module top)
    ctx = {}
    try:
        # Total users
        users_resp = supabase.table("user").select("id").execute()
        total_users = len(getattr(users_resp, "data", []) or [])
    except Exception:
        total_users = 0

    try:
        # Total items and available items
        items_resp = supabase.table("item").select("item_id,available").execute()
        items_data = getattr(items_resp, "data", []) or []
        total_items = len(items_data)
        available_items_count = sum(1 for it in items_data if bool(it.get("available")))
    except Exception:
        total_items = 0
        available_items_count = 0

    try:
        # Requests: active / pending / approved
        req_resp = supabase.table("request").select(
            "request_id,item_id,user_id,request_date,return_date,status,return"
        ).execute()
        reqs = getattr(req_resp, "data", []) or []
        active_requests = len([r for r in reqs if (r.get("status") or "").lower() in ("pending","approved")])
        pending_requests = len([r for r in reqs if (r.get("status") or "").lower() == "pending"])
    except Exception:
        reqs = []
        active_requests = 0
        pending_requests = 0

    # Issues & overdue heuristic: requests approved and past return_date
    overdue_count = 0
    try:
        for r in reqs:
            status = (r.get("status") or "").lower()
            if status == "approved":
                rd = r.get("return_date")
                if rd:
                    try:
                        parsed = datetime.fromisoformat(rd) if isinstance(rd, str) else rd
                        parsed_utc = parsed if parsed.tzinfo else parsed.replace(tzinfo=None)
                        if parsed_utc < now:
                            overdue_count += 1
                    except Exception:
                        pass
    except Exception:
        overdue_count = 0

    # Borrowing chart data
    try:
        total_lent = len([r for r in reqs if (r.get("status") or "").lower() == "approved" or (r.get("status") or "").lower() == "returned"])
        currently_borrowed = len([r for r in reqs if (r.get("status") or "").lower() == "approved" and not bool(r.get("return") in (True, "True", "true", 1, "1"))])
        borrowing_chart = {
            "labels": ["Total Lent", "Currently Borrowed"],
            "values": [total_lent, currently_borrowed]
        }
    except Exception:
        borrowing_chart = {"labels": ["Total Lent", "Currently Borrowed"], "values": [0,0]}

    # Return performance pie (on-time, late, missing/lost heuristic)
    try:
        on_time = late = missing = 0
        for r in reqs:
            status = (r.get("status") or "").lower()
            if status in ("approved", "returned"):
                if r.get("return") in (True, "True", "true", 1, "1"):
                    # returned: check return_date vs due
                    rd = r.get("return_date") or r.get("request_date")
                    due = r.get("return_date")  # we only have return_date; treat lacking as on-time for simplicity
                    # best-effort: if return_date exists and is past the request_date => on-time/late detection is limited
                    try:
                        if r.get("return"):
                            # treat these as on_time for now (unless return_date beyond expected logic)
                            on_time += 1
                        else:
                            # not returned yet but approved -> count as late if past due
                            rd_due = r.get("return_date")
                            if rd_due:
                                parsed = datetime.fromisoformat(rd_due) if isinstance(rd_due, str) else rd_due
                                if parsed < now:
                                    late += 1
                                else:
                                    on_time += 1
                            else:
                                on_time += 1
                    except Exception:
                        on_time += 1
        return_chart = {"labels": ["On Time", "Late", "Missing/Lost"], "values": [on_time, late, missing]}
    except Exception:
        return_chart = {"labels": ["On Time", "Late", "Missing/Lost"], "values": [0,0,0]}

    # Build borrowed_items rows for the table: approved and not returned
    borrowed_items = []
    try:
        active_borrowed_resp = supabase.table("request").select(
            "request_id,item_id,user_id,request_date,return_date,status,return"
        ).eq("status", "approved").neq("return", True).order("request_date", desc=True).execute()
        active_borrowed = getattr(active_borrowed_resp, "data", []) or []
        # fetch items and users for mapping
        item_ids = [r.get("item_id") for r in active_borrowed if r.get("item_id")]
        user_ids = [r.get("user_id") for r in active_borrowed if r.get("user_id")]
        items_map = {}
        users_map = {}
        if item_ids:
            its = supabase.table("item").select("item_id,title,user_id").in_("item_id", list(set(item_ids))).execute()
            for it in getattr(its, "data", []) or []:
                items_map[it.get("item_id")] = it
        if user_ids:
            us = supabase.table("user").select("id,first_name,last_name,email").in_("id", list(set(user_ids))).execute()
            for u in getattr(us, "data", []) or []:
                display = ((u.get("first_name") or "") + " " + (u.get("last_name") or "")).strip() or u.get("email") or u.get("id")
                users_map[u.get("id")] = display

        for r in active_borrowed:
            it = items_map.get(r.get("item_id"), {})
            item_name = it.get("title") or r.get("item_id")
            owner_id = it.get("user_id") or None
            owner_display = None
            if owner_id:
                # try fetch owner display
                try:
                    oresp = supabase.table("user").select("id,first_name,last_name,email").eq("id", owner_id).maybe_single().execute()
                    od = getattr(oresp, "data", None) or {}
                    owner_display = ((od.get("first_name") or "") + " " + (od.get("last_name") or "")).strip() or od.get("email") or owner_id
                except Exception:
                    owner_display = str(owner_id)
            borrower = users_map.get(r.get("user_id")) or r.get("user_id")
            due_raw = r.get("return_date") or ""
            due_text = ""
            overdue_text = ""
            remaining_text = ""
            if due_raw:
                try:
                    parsed = datetime.fromisoformat(due_raw) if isinstance(due_raw, str) else due_raw
                    parsed_naive = parsed if parsed.tzinfo else parsed
                    due_text = parsed_naive.strftime("%b %d, %Y")
                    if parsed_naive < now:
                        # overdue days
                        delta = now - parsed_naive
                        overdue_text = f"{delta.days} days overdue" if delta.days > 0 else "Overdue"
                    else:
                        delta = parsed_naive - now
                        remaining_text = f"{delta.days} days remaining" if delta.days > 0 else ""
                except Exception:
                    due_text = str(due_raw)
            status_label = r.get("status") or ""
            status_class = "on-time"
            sl = status_label.lower()
            if sl == "approved":
                # if overdue -> late
                status_class = "late" if overdue_text else "on-time"
                label = "Borrowed" if not overdue_text else "Late"
            else:
                label = status_label.title()
            
            borrowed_items.append({
                "request_id": r.get("request_id"),
                "item_name": item_name,
                "item_owner": owner_display or "",
                "borrower": borrower,
                "due_date": due_text,
                "overdue_text": overdue_text,
                "remaining_text": remaining_text,
                "status_label": label,
                "status_class": status_class,
            })
    except Exception:
        borrowed_items = []

    # context assembly
    ctx.update({
        "total_users": total_users,
        "total_items": total_items,
        "available_items": f"{available_items_count} available",
        "active_requests": active_requests,
        "pending_requests": f"{pending_requests} pending",
        "issues_count": 0,
        "overdue": f"{overdue_count} overdue",
        "borrowing_chart": json.dumps(borrowing_chart),
        "return_chart": json.dumps(return_chart),
        "borrowed_items": borrowed_items,
        "borrowed_items_json": json.dumps(borrowed_items),
        "current_borrowed_count": f"{len(borrowed_items)} Items",
    })

    return render(request, "admin/admindashboard.html", ctx)

# --- Approve Requests Page (lists pending requests) ---
@never_cache
@supabase_login_required
def approve_requests_view(request):
    user_id = request.session.get("supabase_user_id")
    notifications, unread_count = fetch_notifications_for(user_id)

    pending_requests = []
    try:
        r = supabase.table('request') \
            .select('request_id,item_id,user_id,request_date,status,return_date') \
            .eq('status', 'pending') \
            .order('request_date', desc=True) \
            .execute()
        pending_requests = r.data or []
        # fetch item titles + requester display names
        item_ids = [p.get('item_id') for p in pending_requests if p.get('item_id')]
        users = list({p.get('user_id') for p in pending_requests if p.get('user_id')})
        items_map = {}
        users_map = {}

        if item_ids:
            items_resp = supabase.table('item').select('item_id,title').in_('item_id', item_ids).execute()
            for it in (items_resp.data or []):
                items_map[it.get('item_id')] = it.get('title')

        if users:
            uresp = supabase.table('user').select('id,first_name,last_name,email').in_('id', list(users)).execute()
            for u in (uresp.data or []):
                display = ((u.get('first_name') or '') + ' ' + (u.get('last_name') or '')).strip() or u.get('email') or u.get('id')
                users_map[u.get('id')] = display

        # attach metadata used by template
        for p in pending_requests:
            p['item_title'] = items_map.get(p.get('item_id')) or p.get('item_id')
            p['requester_name'] = users_map.get(p.get('user_id')) or p.get('user_id')
    except Exception:
        pending_requests = []

    return render(request, "admin/approve_requests.html", {
        "pending_requests": pending_requests,
        "notifications": notifications,
        "unread_count": unread_count,
    })


@never_cache
@supabase_login_required
def manage_users_view(request):
    user_id = request.session.get("supabase_user_id")
    notifications, unread_count = fetch_notifications_for(user_id)

    users = []
    try:
        resp = (
            supabase.table('user')
            .select('id,first_name,last_name,email,profile_picture,is_admin,is_block,created_at')
            .order('created_at', desc=True)
            .execute()
        )

        users = resp.data or []

        for u in users:
            u['display_name'] = (
                ((u.get('first_name') or '') + ' ' + (u.get('last_name') or '')).strip()
                or u.get('email')
                or u.get('id')
            )
            # ensure booleans
            u['is_admin'] = bool(u.get('is_admin'))
            u['is_block'] = bool(u.get('is_block'))

    except Exception:
        users = []

    return render(request, "admin/manage_users.html", {
        "users": users,
        "users_json": users,
        "notifications": notifications,
        "unread_count": unread_count,
    })

STORAGE_BUCKET = getattr(settings, "SUPABASE_STORAGE_BUCKET", "item-images")

def _get_public_or_signed_url(path):
    if not path:
        return ""
    # if DB already stores a full URL, return as-is
    if isinstance(path, str) and (path.startswith("http://") or path.startswith("https://") or path.startswith("data:")):
        return path

    # normalize
    path = path.lstrip("/")

    try:
        public = supabase.storage.from_(SUPABASE_STORAGE_BUCKET).get_public_url(path)
        # try common response shapes
        if isinstance(public, dict):
            url = public.get("publicURL") or public.get("publicUrl") or public.get("publicurl")
            if url:
                return url
        # sometimes .get_public_url returns { "data": {"publicURL": "..." } }
        if getattr(public, "get", None) and isinstance(public.get("data"), dict):
            url = public.get("data").get("publicURL") or public.get("data").get("publicUrl")
            if url:
                return url
    except Exception as e:
        # ignore and try signed url
        print("DEBUG: get_public_url error:", e)

    # fallback: create signed url (1 hour)
    try:
        signed = supabase.storage.from_(SUPABASE_STORAGE_BUCKET).create_signed_url(path, 3600)
        if isinstance(signed, dict):
            signed_url = signed.get("signedURL") or signed.get("signedUrl") or (signed.get("data") or {}).get("signedURL")
            if signed_url:
                return signed_url
        if getattr(signed, "get", None) and signed.get("data") and signed["data"].get("signedURL"):
            return signed["data"]["signedURL"]
    except Exception as e:
        print("DEBUG: create_signed_url error:", e)

    return ""


@require_POST
@supabase_login_required
def admin_user_details_api(request):
    """
    POST JSON: { "user_id": "<uuid>" }
    Returns:
        {
          success: True,
          items_owned: [...],
          items_borrowed: [...],
          counts: { total_owned, total_borrowed }
        }
    """
    try:
        # parse JSON
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except Exception:
            return HttpResponseBadRequest(
                json.dumps({"success": False, "error": "invalid json"}),
                content_type="application/json"
            )

        user_id = payload.get("user_id")
        if not user_id:
            return JsonResponse({"success": False, "error": "missing user_id"}, status=400)

        # ------------------------
        # 1) ITEMS OWNED
        # ------------------------
        items_owned = []
        try:
            # your item table uses columns: item_id (pk), user_id (owner FK), image_url (path)
            owned_resp = supabase.table("item").select("*").eq("user_id", user_id).execute()
            items_owned = owned_resp.data or []
        except Exception as e:
            print("Supabase OWNED error:", e)
            items_owned = []

        # normalize and attach thumbnail_url
        for it in items_owned:
            # prefer whatever column holds the storage path
            raw_path = it.get("image_url") or it.get("image") or it.get("image_path") or ""
            thumbnail_url = _get_public_or_signed_url(raw_path) if raw_path else ""
            # fallback to test placeholder if you want quick visual testing
            if not thumbnail_url:
                # comment out next line in production; it's just a dev/testing convenience
                thumbnail_url = TEST_PLACEHOLDER_IMAGE
            it["thumbnail_url"] = thumbnail_url
            # convenience fields for front-end
            it["_thumbnail"] = thumbnail_url
            it["_title"] = it.get("title") or it.get("item_title") or ""

        if items_owned:
            # debug one example to server logs
            sample = items_owned[0]
            print("DEBUG owned sample:", {
                "item_id": sample.get("item_id"),
                "raw_image": sample.get("image_url"),
                "thumbnail_url": sample.get("thumbnail_url")[:200] if sample.get("thumbnail_url") else None
            })

        # ------------------------
        # 2) ITEMS BORROWED / REQUESTS (requests created by this user)
        # ------------------------
        items_borrowed = []
        borrowed_raw = []
        try:
            borrowed_resp = supabase.table("request").select("*").eq("user_id", user_id).execute()
            borrowed_raw = borrowed_resp.data or []
        except Exception as e:
            print("Supabase BORROWED error:", e)
            borrowed_raw = []

        # ------------------------
        # 3) Enrich borrowed with item details
        # ------------------------
        if borrowed_raw:
            # gather item ids from requests (column name in your schema is item_id)
            ids = [r.get("item_id") for r in borrowed_raw if r.get("item_id")]
            items_map = {}
            if ids:
                try:
                    # select item rows where item_id in ids
                    items_resp = supabase.table("item").select("*").in_("item_id", ids).execute()
                    for itm in items_resp.data or []:
                        items_map[str(itm.get("item_id"))] = itm
                except Exception as e:
                    print("Supabase BORROWED lookup error:", e)

            for req in borrowed_raw:
                req_copy = dict(req)
                item_id = req.get("item_id")
                itm = items_map.get(str(item_id))
                if itm:
                    raw_path = itm.get("image_url") or itm.get("image") or itm.get("image_path") or ""
                    thumbnail = _get_public_or_signed_url(raw_path) if raw_path else ""
                    if not thumbnail:
                        # optional dev fallback - remove in production
                        thumbnail = TEST_PLACEHOLDER_IMAGE
                    req_copy["_item"] = {
                        "raw": itm,
                        "thumbnail_url": thumbnail,
                        "title": itm.get("title") or itm.get("item_title") or ""
                    }
                else:
                    req_copy["_item"] = None
                items_borrowed.append(req_copy)

        # ------------------------
        # 4) COUNTS
        # ------------------------
        counts = {
            "total_owned": len(items_owned),
            "total_borrowed": len(items_borrowed),
        }

        return JsonResponse({
            "success": True,
            "items_owned": items_owned,
            "items_borrowed": items_borrowed,
            "counts": counts
        })

    except Exception as exc:
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(exc)}, status=500)


# Toggle user admin status - used via AJAX POST
@require_POST
@supabase_login_required
def toggle_user_admin(request):
    try:
        payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    except Exception:
        payload = {}
    target_id = payload.get('user_id')
    make_admin = payload.get('make_admin') in (True, 'true', 'True', 1, '1')

    if not target_id:
        return JsonResponse({'error': 'user_id required'}, status=400)

    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        return JsonResponse({'error': 'Server misconfigured'}, status=500)

    admin_client = create_supabase_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    try:
        upd = admin_client.table('user').update({'is_admin': make_admin}).eq('id', target_id).execute()
        if getattr(upd, 'error', None):
            return JsonResponse({'error': 'Failed to update'}, status=500)
        return JsonResponse({'success': True, 'is_admin': make_admin})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)



@require_POST
@ajax_require_auth
def report_issue_api(request):
    logger = logging.getLogger(__name__)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        logger.exception("Invalid JSON in report_issue_api")
        return JsonResponse({"success": False, "message": "Invalid JSON"}, status=400)

    user_id = request.session.get("supabase_user_id") or getattr(request.user, "id", None)
    # ajax_require_auth already checked, but keep defensive check
    if not user_id:
        return JsonResponse({"success": False, "message": "Authentication required"}, status=401)

    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    request_id = data.get("request_id")
    item_id = data.get("item_id")
    issue_type = (data.get("issue_type") or "other").strip()

    if not (title or description):
        return JsonResponse({"success": False, "message": "Please provide a short title or description"}, status=400)

    reporter_email = request.session.get("user_email")

    payload = {
        "request_id": request_id,
        "item_id": item_id,
        "reported_by": user_id,
        "reported_by_email": reporter_email,
        "issue_type": issue_type,
        "title": title,
        "description": description,
        "status": "open",
        "created_at": timezone.now().isoformat()
    }

    try:
        resp = supabase.table("reports").insert(payload).execute()
        if getattr(resp, "error", None):
            logger.error("Supabase insert error: %s", resp.error)
            return JsonResponse({"success": False, "message": str(resp.error)}, status=500)

        inserted = resp.data[0] if getattr(resp, "data", None) and len(resp.data) > 0 else payload
        return JsonResponse({"success": True, "report": inserted})
    except Exception:
        logger.exception("Exception while inserting report into Supabase")
        return JsonResponse({"success": False, "message": "Internal server error"}, status=500)

# Admin view to list reports for admin panel
@supabase_login_required
@require_GET
def admin_reports_view(request):
    # ensure admin guard
    is_admin = request.session.get("is_admin", False)
    if not is_admin:
        return HttpResponseForbidden("Forbidden")

    try:
        resp = supabase.table("reports").select("*").order("created_at", desc=True).execute()
        reports = resp.data if getattr(resp, "data", None) else []
    except Exception as e:
        logger.exception("Supabase error listing reports: %s", e)
        reports = []

    # compute counts server-side (fallback; client will recalc too)
    counts = {"open": 0, "in_progress": 0, "resolved": 0}
    for r in reports:
        s = (r.get("status") or "open").lower()
        if s in counts:
            counts[s] += 1
        elif s == "in progress":
            counts["in_progress"] += 1
        else:
            counts["open"] += 1

    return render(request, "admin/reports.html", {"reports": reports, "counts": counts})

@require_POST
@supabase_login_required
def admin_update_report_status(request):
    # admin guard
    if not request.session.get("is_admin"):
        return JsonResponse({"success": False, "message": "Forbidden"}, status=403)

    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"success": False, "message": "Invalid JSON"}, status=400)

    report_id = data.get("report_id")
    status = data.get("status")
    if not report_id or status not in ("open", "in_progress", "resolved", "in progress"):
        return JsonResponse({"success": False, "message": "Bad request"}, status=400)

    # normalize to underscore style
    normalized = "in_progress" if status == "in progress" else status

    try:
        resp = supabase.table("reports").update({"status": normalized}).eq("report_id", report_id).execute()
        if getattr(resp, "error", None):
            logger.error("Supabase update error: %s", resp.error)
            return JsonResponse({"success": False, "message": str(resp.error)}, status=500)
        # optionally return updated row or success
        return JsonResponse({"success": True, "status": normalized})
    except Exception as e:
        logger.exception("Exception updating report status: %s", e)
        return JsonResponse({"success": False, "message": str(e)}, status=500)

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
            "created_at": datetime.utcnow().isoformat(),
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
    user_id = request.session.get('supabase_user_id')
    payload = json.loads(request.body.decode('utf-8')) if request.body else {}
    req_id = payload.get('request_id')

    if not req_id:
        return JsonResponse({'errors': {'general': [{'message': 'request_id required'}]}}, status=400)

    # Fetch the request row
    rresp = supabase.table('request').select('*').eq('request_id', req_id).single().execute()
    if getattr(rresp, 'error', None) or not rresp.data:
        return JsonResponse({'errors': {'general': [{'message': 'Request not found'}]}}, status=404)
    req = rresp.data

    # Verify that this request belongs to the current user (borrower marks returned)
    if req.get('user_id') != user_id:
        return JsonResponse({'errors': {'general': [{'message': 'Permission denied'}]}}, status=403)

    item_id = req.get('item_id')

    try:
        supabase.table('request').update({'return': True}).eq('request_id', req_id).execute()

        # FIX: Make the item available again so new requests make sense
        supabase.table('item').update({'available': True}).eq('item_id', item_id).execute()

        # Optional: notify the owner
        try:
            item_resp = supabase.table('item').select('title,user_id').eq('item_id', item_id).maybe_single().execute()
            if getattr(item_resp, 'data', None):
                title = item_resp.data.get('title', 'an item')
                owner_id = item_resp.data.get('user_id')
                if owner_id:
                    notif_payload = {
                        'notification_id': str(uuid.uuid4()),
                        'user_id': owner_id,
                        'message': f"{request.session.get('user_email','Someone')} marked \"{title}\" as returned.",
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

def user_context(request):
    """
    Add user info and notification count to all templates
    This replaces the need for passing these in every view
    """
    context = {
        'user_info': None,
        'notifications': [],
        'unread_count': 0,
    }
    
    user_id = request.session.get('supabase_user_id')
    
    if user_id:
        try:
            # Initialize Supabase client
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # Fetch user info
            profile_resp = supabase.table("user").select("*").eq("id", user_id).single().execute()
            user_info = profile_resp.data if profile_resp and getattr(profile_resp, "data", None) else {}
            
            # Get email from Supabase Auth (source of truth)
            if user_info:
                try:
                    auth_user_resp = supabase.auth.admin.get_user_by_id(user_id)
                    if auth_user_resp.user:
                        user_info["email"] = auth_user_resp.user.email
                        request.session['user_email'] = auth_user_resp.user.email
                except Exception as e:
                    if request.session.get('user_email'):
                        user_info["email"] = request.session.get('user_email')
            
            context['user_info'] = user_info
            
            # Use your existing fetch_notifications_for function
            from .views import fetch_notifications_for
            notifications, unread_count = fetch_notifications_for(user_id)
            
            context['notifications'] = notifications
            context['unread_count'] = unread_count
            
        except Exception as e:
            print(f"Error in user_context: {e}")
            # Return empty context on error
            pass
    
    return context


@supabase_login_required
def my_items(request):
    user_id = request.session.get("supabase_user_id")
    notifications, unread_count = fetch_notifications_for(user_id)

    items = []
    try:
        items_resp = supabase.table("item") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()
        items = items_resp.data or []
    except Exception as exc:
        print("Error fetching items:", exc)
        items = []

    items_with_requests = []
    try:
        item_ids = [itm.get("item_id") for itm in items if itm.get("item_id")]
        reqs = []
        if item_ids:
            req_resp = supabase.table("request") \
                .select("request_id,item_id,user_id,request_date,return,status") \
                .in_("item_id", item_ids) \
                .order("request_date", desc=True) \
                .execute()
            reqs = req_resp.data or []

        # build user map for requester display
        requester_ids = list({r.get("user_id") for r in reqs if r.get("user_id")})
        users_map = {}
        if requester_ids:
            uresp = supabase.table("user").select("id,first_name,last_name,email").in_("id", requester_ids).execute()
            for u in (uresp.data or []):
                display = ((u.get("first_name") or "") + " " + (u.get("last_name") or "")).strip()
                if not display:
                    display = u.get("email") or u.get("id")
                users_map[u.get("id")] = display

        # group requests by item_id (already ordered desc)
        reqs_by_item = {}
        for r in reqs:
            iid = r.get("item_id")
            rd = r.get("request_date")
            try:
                r_dt = datetime.fromisoformat(rd) if isinstance(rd, str) else rd
                human = r_dt.strftime("%b %d, %Y · %I:%M %p") if r_dt else rd
            except Exception:
                human = rd or ""
            entry = {
                "request_id": r.get("request_id"),
                "user_id": r.get("user_id"),
                "requester_name": users_map.get(r.get("user_id"), r.get("user_id")),
                "request_date_human": human,
                "status": (r.get("status") or "").lower(),
                "return": bool(r.get("return")),
                "raw_request_date": r.get("request_date"),
            }
            reqs_by_item.setdefault(iid, []).append(entry)

        total_available = 0
        total_pending = 0

        for it in items:
            iid = it.get("item_id")
            item_reqs = reqs_by_item.get(iid, [])

            # default
            status_label = "available"
            latest_approved = None

            # find the first approved in descending list
            for r in item_reqs:
                if (r.get("status") or "").lower() == "approved":
                    latest_approved = r
                    break

            if latest_approved:
                if latest_approved.get("return") is True:
                    status_label = "returned"
                else:
                    status_label = "borrowed"
            else:
                # check pending
                has_pending = any((r.get("status") or "").lower() == "pending" for r in item_reqs)
                status_label = "pending" if has_pending else "available"

            # counts
            if status_label == "available":
                total_available += 1
            total_pending += sum(1 for r in item_reqs if (r.get("status") or "").lower() == "pending")

            pending_reqs = [r for r in item_reqs if (r.get("status") or "").lower() == "pending"]

            # normalize before rendering
            status_label = str(status_label or "unknown").strip().lower()

            items_with_requests.append({
                "item_id": iid,
                "title": it.get("title"),
                "description": it.get("description") or "",
                "image_url": it.get("image_url") or "",
                "category": it.get("category") or "",
                "condition": it.get("condition") or "",
                "available": bool(it.get("available")),
                "status_label": status_label,
                "requests": item_reqs,
                "pending_requests": pending_reqs,
            })
    except Exception as e:
        print("Error in my_items:", e)

    return render(request, "my_items.html", {
        "items": items_with_requests,
        "notifications": notifications,
        "unread_count": unread_count,
        "available_count": total_available,
        "pending_count": total_pending,
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY,
        "SUPABASE_USER_ID": request.session.get("supabase_user_id", ""),
    })

@require_http_methods(["GET", "POST"])
@supabase_login_required
def edit_item(request, item_id):
    user_id = request.session.get("supabase_user_id")
    if not user_id:
        return redirect("login")

    # fetch item
    try:
        resp = supabase.table("item").select("*").eq("item_id", item_id).single().execute()
        if getattr(resp, "error", None) or not resp.data:
            messages.error(request, "Item not found.")
            return redirect("my_items")
        item = resp.data
    except Exception:
        messages.error(request, "Failed to fetch item.")
        return redirect("my_items")

    if item.get("user_id") != user_id:
        return HttpResponseForbidden("Permission denied")

    if request.method == "POST":
        title = (request.POST.get("title") or "").strip()
        description = (request.POST.get("description") or "").strip()
        category = (request.POST.get("category") or "").strip()
        condition = (request.POST.get("condition") or "").strip()
        availability = (request.POST.get("available") or "true").lower() in ("true", "1", "on", "yes", "available")

        # handle uploaded image (optional)
        file = request.FILES.get("image")
        image_url = item.get("image_url")
        if file and SUPABASE_SERVICE_ROLE_KEY:
            try:
                admin_client = create_supabase_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
                ext = os.path.splitext(file.name)[1] or ".bin"
                filename = f"{user_id}/{uuid.uuid4()}{ext}"
                upload_res = admin_client.storage.from_("item-images").upload(filename, file.read())
                if getattr(upload_res, "error", None):
                    messages.error(request, "Failed to upload image.")
                else:
                    public = admin_client.storage.from_("item-images").get_public_url(filename)
                    # public might be dict or object; try safe retrieval
                    image_url = (public.get("publicUrl") if isinstance(public, dict) and public.get("publicUrl")
                                 else getattr(public, "public_url", None) or getattr(public, "publicUrl", None) or public)
            except Exception as e:
                messages.error(request, "Image upload failed.")
        # update the item record
        try:
            update_resp = supabase.table("item").update({
                "title": title,
                "description": description,
                "category": category,
                "condition": condition,
                "available": availability,
                "image_url": image_url,
            }).eq("item_id", item_id).execute()

            if getattr(update_resp, "error", None):
                messages.error(request, "Failed to update item.")
            else:
                messages.success(request, "Item updated.")
                return redirect("my_items")
        except Exception as e:
            messages.error(request, "Update failed: " + str(e))

    # Prepare item for template
    item['image_url'] = item.get('image_url')
    return render(request, "edit_item.html", {"item": item})


@require_POST
@supabase_login_required
def delete_item(request, item_id):
    user_id = request.session.get("supabase_user_id")
    if not user_id:
        return JsonResponse({"error": "Not authenticated"}, status=401)

    # fetch item
    try:
        r = supabase.table('item').select('item_id,user_id,available').eq('item_id', item_id).maybe_single().execute()
        if getattr(r, 'error', None) or not r.data:
            return JsonResponse({"error": "Item not found"}, status=404)
        item = r.data
    except Exception as e:
        return JsonResponse({"error": "Failed to fetch item"}, status=500)

    if item.get('user_id') != user_id:
        return HttpResponseForbidden("Permission denied")

    # Use service role (admin) client to delete item + related requests/storage if desired
    if not SUPABASE_SERVICE_ROLE_KEY:
        return JsonResponse({"error": "Server misconfigured"}, status=500)

    admin = create_supabase_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    try:
        # Optionally delete requests for this item (cleanup)
        try:
            admin.table('request').delete().eq('item_id', item_id).execute()
        except Exception:
            pass

        # Delete item row
        del_resp = admin.table('item').delete().eq('item_id', item_id).execute()
        if getattr(del_resp, 'error', None):
            return JsonResponse({"error": "Failed to delete item"}, status=500)

        # If you want to delete the stored image object from storage, you can do it here
        # image_url = item.get('image_url') or ''
        # parse and remove file path from your storage bucket (skip if not needed)

        # Tell client whether counts should change
        dec_available = bool(item.get('available'))
        # pending: compute quickly whether there were pending requests previously (optional)
        # We'll return decrement flags; JS will update counters
        pending_count_resp = supabase.table('request').select('request_id').eq('item_id', item_id).eq('status','pending').execute()
        pending_num = len(pending_count_resp.data or []) if getattr(pending_count_resp, 'data', None) else 0

        return JsonResponse({
            "success": True,
            "decrement_available": 1 if dec_available else 0,
            "decrement_pending": pending_num
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
