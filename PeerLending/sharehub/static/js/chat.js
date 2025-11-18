// sharehub/static/js/chat.js
// Full chat client for ShareHub (improved: selected head + header title + cleaner DOM)
(function () {
  "use strict";

  function getCookie(name) {
    const match = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return match ? decodeURIComponent(match.pop()) : "";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  document.addEventListener("DOMContentLoaded", () => {
    console.info("chat.js loaded (DOMContentLoaded)");

    const SUPABASE_URL = window.SUPABASE_URL || "";
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";
    const CURRENT_USER_ID = window.SUPABASE_USER_ID || "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn("Supabase keys missing (window.SUPABASE_URL / SUPABASE_ANON_KEY). Chat disabled.");
      return;
    }

    let sb;
    try {
      sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.error("Failed to create Supabase client:", e);
      return;
    }

    // DOM elements (from base.html)
    let chatBtn = document.getElementById("chatBtn");
    const chatOverlay = document.getElementById("chatOverlay");
    const chatPopup = document.getElementById("chatPopup");
    const chatList = document.getElementById("chatList");
    const chatWindow = document.getElementById("chatWindow");
    const messagesEl = document.getElementById("messages");
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const closeChatBtn = document.getElementById("closeChat");

    // fallback / inject chat button if missing
    if (!chatBtn) {
      chatBtn = document.querySelector(".chat-btn") || document.querySelector("[data-chat-btn]") || null;
      if (!chatBtn) {
        const header = document.querySelector("header") || document.querySelector(".nav-container") || document.body;
        if (header) {
          const btn = document.createElement("button");
          btn.id = "chatBtn";
          btn.type = "button";
          btn.title = "Open chats";
          btn.className = "chat-icon-button";
          btn.style = "background:none;border:0;cursor:pointer;padding:6px;margin-left:8px;";
          btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"></path></svg>`;
          header.appendChild(btn);
          chatBtn = btn;
          console.info("No chat button found — injected one into page header. Prefer adding #chatBtn to your header.html for custom placement.");
        }
      } else {
        console.warn("chatBtn not found by id. Using fallback element.");
      }
    }

    if (!chatPopup || !chatOverlay || !chatList || !chatForm || !chatInput || !messagesEl) {
      console.warn("Some chat DOM elements are missing. Required: #chatPopup, #chatOverlay, #chatList, #chatForm, #chatInput, #messages.");
    }

    let activeConversation = null;
    let channel = null;
    let headsInterval = null;

    function toggleChat(open) {
      if (!chatPopup || !chatOverlay) {
        console.warn("Chat popup or overlay missing");
        return;
      }
      if (open) {
        chatPopup.style.display = "block";
        chatOverlay.style.display = "block";
        chatPopup.setAttribute("aria-hidden", "false");
        chatOverlay.setAttribute("aria-hidden", "false");
        loadChatHeads();
      } else {
        chatPopup.style.display = "none";
        chatOverlay.style.display = "none";
        chatPopup.setAttribute("aria-hidden", "true");
        chatOverlay.setAttribute("aria-hidden", "true");
        closeConversation();
      }
    }

    if (chatBtn) {
      chatBtn.addEventListener("click", () => {
        const currentlyOpen = chatPopup && chatPopup.style.display === "block";
        toggleChat(!currentlyOpen);
      });
    }

    if (chatOverlay) chatOverlay.addEventListener("click", () => toggleChat(false));
    if (closeChatBtn) closeChatBtn.addEventListener("click", () => toggleChat(false));

    function setChatListLoading() {
      if (!chatList) return;
      chatList.innerHTML = '<div class="loading">Loading...</div>';
    }

    async function loadChatHeads() {
      if (!chatList) return;
      setChatListLoading();
      try {
        const res = await fetch("/api/chat/heads/");
        if (!res.ok) throw new Error(`Heads request failed: ${res.status}`);
        const data = await res.json();
        renderChatHeads(data.results || []);
      } catch (e) {
        console.error("Failed to load chat heads:", e);
        if (chatList) chatList.innerHTML = '<div class="error">Failed to load chats.</div>';
      }
    }

    function clearSelectedHeads() {
      document.querySelectorAll(".chat-head.selected").forEach((el) => el.classList.remove("selected"));
    }

    function renderChatHeads(heads) {
      if (!chatList) return;
      chatList.innerHTML = "";
      if (!heads || heads.length === 0) {
        chatList.innerHTML = '<div class="empty">No conversations yet.</div>';
        return;
      }
      heads.forEach((h) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chat-head";
        btn.dataset.conv = h.conversation_id || "";
        // keep minimal markup; unread badge removed
        btn.innerHTML = `
          <div class="head-left">
            <div class="head-title">${escapeHtml(h.item_title || "Item")}</div>
            <div class="head-sub">${escapeHtml(h.last_message || "")}</div>
          </div>
        `;
        btn.addEventListener("click", () => {
          clearSelectedHeads();
          btn.classList.add("selected");
          setPopupHeaderTitle(h.item_title || "Conversation");
          openConversation(h.conversation_id);
        });
        chatList.appendChild(btn);
      });
    }

    function setPopupHeaderTitle(title) {
      if (!chatPopup) return;
      const headerTitleEl = chatPopup.querySelector(".chat-header .title");
      if (headerTitleEl) headerTitleEl.textContent = title || "Chats";
    }

    async function openConversation(convId) {
      activeConversation = convId;
      // set header title from selected head if present
      const sel = document.querySelector(`.chat-head[data-conv="${convId}"]`);
      const title = sel ? (sel.querySelector(".head-title")?.textContent || "Conversation") : "Conversation";
      setPopupHeaderTitle(title);

      if (!messagesEl || !chatWindow) return;
      chatWindow.style.display = "flex";
      messagesEl.innerHTML = "<div class='loading'>Loading messages...</div>";

      try {
        const res = await fetch(`/api/chat/${convId}/messages/`);
        if (!res.ok) throw new Error(`Messages request failed: ${res.status}`);
        const j = await res.json();
        const msgs = j.results || [];
        messagesEl.innerHTML = "";
        msgs.forEach((m) => appendMessage(m.sender_id, m.content, m.created_at));
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } catch (e) {
        console.error("Failed to fetch messages:", e);
        messagesEl.innerHTML = "<div class='error'>Failed to load messages.</div>";
      }

      // unsubscribe previous channel
      if (channel) {
        try {
          channel.unsubscribe();
        } catch (err) {}
        channel = null;
      }

      // subscribe to messages via Supabase realtime
      try {
        channel = sb
          .channel(`conversation:${convId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
            (payload) => {
              console.debug("realtime payload received for conv", convId, payload);
              try {
                const newMsg = payload.new;
                appendMessage(newMsg.sender_id, newMsg.content, newMsg.created_at, newMsg.id);
                messagesEl.scrollTop = messagesEl.scrollHeight;
              } catch (err) {
                console.error("error handling realtime payload", err, payload);
              }
            }
          )
          .subscribe((status) => {
            console.debug("supabase channel status:", status);
          });
      } catch (e) {
        console.warn("Realtime subscription failed:", e);
      }
    }

    function closeConversation() {
      activeConversation = null;
      if (chatWindow) chatWindow.style.display = "none";
      if (messagesEl) messagesEl.innerHTML = "";
      if (channel) {
        try {
          channel.unsubscribe();
        } catch (e) {}
        channel = null;
      }
      clearSelectedHeads();
      setPopupHeaderTitle("Chats");
    }

    function appendMessage(senderId, text, when, msgId) {
      if (!messagesEl) return;

      // prevent duplicates from realtime + POST
      if (msgId && messagesEl.querySelector(`[data-msg-id="${msgId}"]`)) {
        return; // already displayed
      }

      const row = document.createElement("div");
      row.className = "message-row";
      if (msgId) row.dataset.msgId = msgId;

      const mine = senderId && CURRENT_USER_ID && String(senderId) === String(CURRENT_USER_ID);

      const bubble = document.createElement("div");
      bubble.className = "message " + (mine ? "mine" : "theirs");
      bubble.innerHTML = `
        <div class="msg-content">${escapeHtml(text || "")}</div>
        <div class="msg-time">${when ? new Date(when).toLocaleString() : ""}</div>
      `;

      if (mine) bubble.style.marginLeft = "auto";
      else bubble.style.marginRight = "auto";

      row.appendChild(bubble);
      messagesEl.appendChild(row);
    }

    if (chatForm && chatInput) {
      chatForm.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        if (!activeConversation) {
          console.warn("No active conversation to post to.");
          return;
        }
        const txt = chatInput.value.trim();
        if (!txt) return;
        chatInput.value = "";
        try {
          const res = await fetch(`/api/chat/${activeConversation}/post/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": getCookie("csrftoken"),
            },
            body: JSON.stringify({ content: txt }),
          });
          const j = await res.json();
          if (!res.ok || !j || !j.success) {
            console.warn("Failed to post message", j);
            // fallback to show the message locally
            appendMessage(CURRENT_USER_ID, txt, new Date().toISOString(), j && j.message ? j.message.id : undefined);
          }
        } catch (e) {
          console.error("post message error", e);
          appendMessage(CURRENT_USER_ID, txt, new Date().toISOString());
        }
      });
    }

    window.startChat = async function (itemId) {
      if (!itemId) {
        console.warn("startChat called without itemId");
        return;
      }
      try {
        const res = await fetch(`/api/chat/start/${itemId}/`, {
          method: "POST",
          headers: {
            "X-CSRFToken": getCookie("csrftoken"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        const j = await res.json();
        if (res.ok && j && j.conversation_id) {
          toggleChat(true);
          setTimeout(() => {
            // mark head selected visually if present
            const sel = document.querySelector(`.chat-head[data-conv="${j.conversation_id}"]`);
            if (sel) {
              clearSelectedHeads();
              sel.classList.add("selected");
              setPopupHeaderTitle(sel.querySelector(".head-title")?.textContent || "Conversation");
            }
            openConversation(j.conversation_id);
          }, 150);
        } else {
          console.warn("startChat failed", j);
        }
      } catch (e) {
        console.error("startChat error", e);
      }
    };

    function startHeadsPoll() {
      if (headsInterval) return;
      headsInterval = setInterval(() => {
        if (chatPopup && chatPopup.style.display === "block") {
          loadChatHeads();
        }
      }, 20000);
    }
    function stopHeadsPoll() {
      if (headsInterval) {
        clearInterval(headsInterval);
        headsInterval = null;
      }
    }

    startHeadsPoll();

    window.toggleChat = toggleChat;

    window.addEventListener("beforeunload", () => {
      if (channel) {
        try {
          channel.unsubscribe();
        } catch (e) {}
      }
      stopHeadsPoll();
    });

    // debug info
    console.debug("chat.js initialized", {
      SUPABASE_URL: SUPABASE_URL ? "ok" : "missing",
      SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? "ok" : "missing",
      CURRENT_USER_ID: CURRENT_USER_ID ? "ok" : "missing",
      elements: { chatBtn: !!chatBtn, chatPopup: !!chatPopup, chatList: !!chatList, chatForm: !!chatForm },
    });
  }); // DOMContentLoaded end
})(); // IIFE end
