# PeerLending/chat/views.py
import json
import logging
from functools import wraps

from django.conf import settings
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.http import require_POST
from supabase import create_client as create_supabase_client

SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
logger = logging.getLogger(__name__)

# server client uses service role key (must be kept server-side)
server_client = create_supabase_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_SERVICE_ROLE_KEY else None


def supabase_login_required(view_func):
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if request.session.get("supabase_user_id"):
            return view_func(request, *args, **kwargs)
        return HttpResponseForbidden("Not authenticated")
    return _wrapped


@supabase_login_required
def chat_heads(request):
    """
    Robust chat_heads: returns conversation heads along with other participant's name and avatar.
    Defensive: tolerates different user table names and logs exceptions.
    """
    user_id = request.session.get("supabase_user_id")
    if not user_id:
        return JsonResponse({"results": []})

    if not server_client:
        logger.error("chat_heads: server_client (service role) not configured.")
        return JsonResponse({"error": "Server chat unavailable (missing service role key)."}, status=500)

    try:
        # get conversation ids where current user is participant
        parts = server_client.from_("conversation_participants").select("conversation_id").eq("user_id", user_id).execute()
        conv_ids = [p.get("conversation_id") for p in (getattr(parts, "data", None) or []) if p.get("conversation_id")]
        if not conv_ids:
            return JsonResponse({"results": []})

        # load conversations
        convs_resp = server_client.from_("conversations").select("*").in_("id", conv_ids).execute()
        convs = getattr(convs_resp, "data", []) or []

        results = []

        # prepare candidate user tables to try for fetching user profile
        candidate_user_tables = ["user", "users", "profiles", "auth.users"]

        for c in convs:
            try:
                # latest message
                last_resp = server_client.from_("messages").select("*").eq("conversation_id", c["id"]).order("created_at", desc=True).limit(1).execute()
                last = (getattr(last_resp, "data", None) or [None])[0]

                # unread count (messages not from me and not read)
                unread_resp = server_client.from_("messages").select("id").eq("conversation_id", c["id"]).eq("is_read", False).neq("sender_id", user_id).execute()
                unread_count = len(getattr(unread_resp, "data", None) or [])

                # participants -> find the other user
                parts_resp = server_client.from_("conversation_participants").select("user_id").eq("conversation_id", c["id"]).execute()
                participants = [p.get("user_id") for p in (getattr(parts_resp, "data", None) or []) if p.get("user_id")]
                other = next((p for p in participants if p != user_id), None)

                other_name = None
                other_avatar = None

                if other:
                    # try candidate tables until one returns a profile
                    profile = None
                    for tbl in candidate_user_tables:
                        try:
                            # request common fields; some tables may not have these fields but it's okay
                            q = server_client.from_(tbl).select("id, first_name, last_name, avatar_url, email").eq("id", other).maybe_single().execute()
                            profile = getattr(q, "data", None)
                            if profile:
                                break
                        except Exception:
                            # ignore and try next table
                            continue

                    # fallback: if no profile found, try simple select for any available columns
                    if not profile:
                        try:
                            q2 = server_client.from_(candidate_user_tables[0]).select("*").eq("id", other).maybe_single().execute()
                            profile = getattr(q2, "data", None)
                        except Exception:
                            profile = None

                    if profile:
                        display = ((profile.get("first_name") or "") + " " + (profile.get("last_name") or "")).strip()
                        if not display:
                            display = profile.get("email") or profile.get("id") or str(other)
                        other_name = display
                        # avatar_url field name may differ; try a few common keys
                        other_avatar = profile.get("avatar_url") or profile.get("avatar") or profile.get("profile_image") or None

                results.append({
                    "conversation_id": c.get("id"),
                    "item_id": c.get("item_id"),
                    "item_title": c.get("item_title"),
                    "other_id": other,
                    "other_name": other_name,
                    "other_avatar": other_avatar,
                    "last_message": last.get("content") if last else None,
                    "last_at": last.get("created_at") if last else None,
                    "unread_count": unread_count,
                })

            except Exception as inner_e:
                logger.exception("chat_heads: error processing conversation id %s: %s", c.get("id"), inner_e)
                # continue to next conversation instead of failing whole endpoint
                continue

        return JsonResponse({"results": results})
    except Exception as e:
        # log full exception so you can see stacktrace in server console
        logger.exception("chat_heads: unexpected error: %s", e)
        return JsonResponse({"error": "Internal server error while fetching chat heads."}, status=500)

@supabase_login_required
def get_messages(request, conversation_id):
    """
    GET /api/chat/<conversation_id>/messages/ -> returns ordered messages and marks unread messages as read
    """
    user_id = request.session.get("supabase_user_id")
    check = server_client.from_("conversation_participants").select("*").eq("conversation_id", conversation_id).eq("user_id", user_id).maybe_single().execute()
    if getattr(check, "error", None) or not check.data:
        return HttpResponseForbidden("No access")

    msgs_resp = server_client.from_("messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=False).execute()
    msgs = msgs_resp.data or []

    # best-effort mark as read (only messages not sent by current user)
    try:
        server_client.from_("messages").update({"is_read": True}).eq("conversation_id", conversation_id).eq("is_read", False).neq("sender_id", user_id).execute()
    except Exception:
        pass

    return JsonResponse({"results": msgs})


@require_POST
@supabase_login_required
def start_conversation(request, item_id):
    """
    POST /api/chat/start/<item_id>/ -> creates (or returns existing) conversation between current user and item owner
    """
    user_id = request.session.get("supabase_user_id")

    # fetch item to find owner and title
    it = server_client.from_("item").select("item_id,title,user_id").eq("item_id", item_id).maybe_single().execute()
    if getattr(it, "error", None) or not it.data:
        return JsonResponse({"error": "Item not found"}, status=404)
    item = it.data
    owner_id = item.get("user_id")
    if owner_id == user_id:
        return JsonResponse({"error": "Cannot start conversation with yourself"}, status=400)

    # search for an existing conversation for same item where both participants exist
    existing = server_client.from_("conversations").select("*").eq("item_id", item_id).execute()
    for c in (existing.data or []):
        parts = server_client.from_("conversation_participants").select("user_id").eq("conversation_id", c["id"]).execute()
        pids = [p["user_id"] for p in (parts.data or [])]
        if user_id in pids and owner_id in pids:
            return JsonResponse({"conversation_id": c["id"]})

    # create conversation
    conv = server_client.from_("conversations").insert({
        "item_id": item_id,
        "item_title": item.get("title"),
        "item_owner_id": owner_id
    }).execute()
    if getattr(conv, "error", None):
        return JsonResponse({"error": "Failed to create conversation"}, status=500)
    conv_id = conv.data[0]["id"]

    # add participants
    server_client.from_("conversation_participants").insert([
        {"conversation_id": conv_id, "user_id": owner_id},
        {"conversation_id": conv_id, "user_id": user_id}
    ]).execute()

    return JsonResponse({"conversation_id": conv_id})


@require_POST
@supabase_login_required
def post_message(request, conversation_id):
    """
    POST /api/chat/<conversation_id>/post/ -> server inserts a message row (trusted service role)
    """
    user_id = request.session.get("supabase_user_id")
    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        payload = {}

    content = payload.get("content") or request.POST.get("content")
    if not content:
        return JsonResponse({"error": "Empty message"}, status=400)

    check = server_client.from_("conversation_participants").select("*").eq("conversation_id", conversation_id).eq("user_id", user_id).maybe_single().execute()
    if getattr(check, "error", None) or not check.data:
        return HttpResponseForbidden("No access")

    ins = server_client.from_("messages").insert({
        "conversation_id": conversation_id,
        "sender_id": user_id,
        "content": content
    }).execute()
    if getattr(ins, "error", None):
        return JsonResponse({"error": "Insert failed"}, status=500)

    return JsonResponse({"success": True, "message": ins.data[0]})

