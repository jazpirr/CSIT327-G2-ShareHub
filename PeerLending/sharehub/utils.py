from functools import wraps
from django.shortcuts import redirect
from django.views.decorators.cache import never_cache
 
def supabase_login_required(view_func):
    @wraps(view_func)
    @never_cache
    def _wrapped(request, *args, **kwargs):
        if not request.session.get("supabase_user_id"):
            return redirect("login")
        resp = view_func(request, *args, **kwargs)
       
        resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp["Pragma"] = "no-cache"
        resp["Expires"] = "0"
        return resp
    return _wrapped