from functools import wraps
from django.shortcuts import redirect
from django.views.decorators.cache import never_cache
from .models import CustomUser
from django.utils.dateparse import parse_date
from django.http import JsonResponse

 
def _is_json_or_ajax_request(request):
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return True
    accept = request.headers.get('Accept', '')
    if 'application/json' in accept:
        return True
    content_type = request.headers.get('Content-Type') or request.content_type or ''
    if 'application/json' in content_type:
        return True
    return False

def supabase_login_required(view_func):
    @wraps(view_func)
    @never_cache
    def _wrapped(request, *args, **kwargs):
        # Allow if supabase session exists
        if request.session.get("supabase_user_id"):
            resp = view_func(request, *args, **kwargs)
            try:
                resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
                resp["Pragma"] = "no-cache"
                resp["Expires"] = "0"
            except Exception:
                pass
            return resp

        # Allow if session admin flag set
        if request.session.get("is_admin"):
            resp = view_func(request, *args, **kwargs)
            try:
                resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
                resp["Pragma"] = "no-cache"
                resp["Expires"] = "0"
            except Exception:
                pass
            return resp

        # Allow if Django user is staff/superuser
        try:
            user = getattr(request, "user", None)
            if user and (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False)):
                resp = view_func(request, *args, **kwargs)
                try:
                    resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
                    resp["Pragma"] = "no-cache"
                    resp["Expires"] = "0"
                except Exception:
                    pass
                return resp
        except Exception:
            pass

        # Not authenticated: respond appropriately depending on request type
        if _is_json_or_ajax_request(request):
            return JsonResponse(
                {'errors': {'general': [{'message': 'Not authenticated'}]}},
                status=401
            )

        # Fallback: redirect to login for normal page requests
        return redirect("login")

    return _wrapped
    
def sync_user_to_orm(supabase_user_id, profile_dict):
    """
    Ensure a CustomUser row exists for supabase_user_id and update fields.
    profile_dict is a dict with keys like email, first_name, last_name, birthday, phone_number...
    """
    defaults = {}
    if "email" in profile_dict:
        defaults["email"] = profile_dict.get("email")
    if "first_name" in profile_dict:
        defaults["first_name"] = profile_dict.get("first_name")
    if "last_name" in profile_dict:
        defaults["last_name"] = profile_dict.get("last_name")
    if "birthday" in profile_dict and profile_dict.get("birthday"):
        # parse strings safely
        try:
            defaults["birthday"] = parse_date(profile_dict.get("birthday"))
        except Exception:
            defaults["birthday"] = None
    if "phone_number" in profile_dict:
        defaults["phone_number"] = profile_dict.get("phone_number")
    if "college_dept" in profile_dict:
        defaults["college_dept"] = profile_dict.get("college_dept")
    if "course" in profile_dict:
        defaults["course"] = profile_dict.get("course")
    if "year_level" in profile_dict:
        try:
            defaults["year_level"] = int(profile_dict.get("year_level"))
        except Exception:
            defaults["year_level"] = None

    # id must be the Supabase UUID string
    obj, created = CustomUser.objects.update_or_create(
        id=supabase_user_id,
        defaults=defaults
    )
    return obj