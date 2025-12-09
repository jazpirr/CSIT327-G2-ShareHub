// Full chat client for ShareHub with emoji picker + delete conversation
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

    // DOM elements
    let chatBtn = document.getElementById("chatBtn");
    const chatOverlay = document.getElementById("chatOverlay");
    const chatPopup = document.getElementById("chatPopup");
    const chatList = document.getElementById("chatList");
    const chatWindow = document.getElementById("chatWindow");
    const messagesEl = document.getElementById("messages");
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");
    const closeChatBtn = document.getElementById("closeChat");

    // Fallback / inject chat button if missing
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
          console.info("No chat button found — injected one into page header.");
        }
      }
    }

    if (!chatPopup || !chatOverlay || !chatList || !chatForm || !chatInput || !messagesEl) {
      console.warn("Some chat DOM elements are missing.");
    }

    let activeConversation = null;
    let channel = null;
    let headsInterval = null;

    // Initialize emoji picker
    initEmojiPicker();

    function initEmojiPicker() {
      if (!chatForm) return;

      // Common emojis
      const emojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
        '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
        '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
        '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
        '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖',
        '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
        '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰',
        '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶',
        '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮',
        '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
        '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪',
        '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
        '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
        '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️',
        '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈',
        '🎉', '🎊', '🎈', '🎁', '🎀', '🎂', '🍰', '🧁',
        '🔥', '✨', '💫', '⭐', '🌟', '💥', '💢', '💨'
      ];

      // Wrap input in a container if not already
      if (!chatInput.parentElement.classList.contains('chat-input-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-input-wrapper';
        chatInput.parentNode.insertBefore(wrapper, chatInput);
        wrapper.appendChild(chatInput);

        // Add emoji button
        const emojiBtn = document.createElement('button');
        emojiBtn.type = 'button';
        emojiBtn.className = 'emoji-btn';
        emojiBtn.innerHTML = '😊';
        emojiBtn.title = 'Add emoji';
        wrapper.appendChild(emojiBtn);

        // Create emoji picker
        const emojiPicker = document.createElement('div');
        emojiPicker.className = 'emoji-picker';
        const emojiGrid = document.createElement('div');
        emojiGrid.className = 'emoji-grid';

        emojis.forEach(emoji => {
          const emojiItem = document.createElement('button');
          emojiItem.type = 'button';
          emojiItem.className = 'emoji-item';
          emojiItem.textContent = emoji;
          emojiItem.addEventListener('click', () => {
            chatInput.value += emoji;
            chatInput.focus();
            emojiPicker.classList.remove('active');
          });
          emojiGrid.appendChild(emojiItem);
        });

        emojiPicker.appendChild(emojiGrid);
        chatForm.appendChild(emojiPicker);

        // Toggle emoji picker
        emojiBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          emojiPicker.classList.toggle('active');
        });

        // Close picker when clicking outside
        document.addEventListener('click', (e) => {
          if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
            emojiPicker.classList.remove('active');
          }
        });
      }

      // Update submit button to use icon
      const submitBtn = chatForm.querySelector('button[type="submit"]');
      if (submitBtn && submitBtn.textContent === 'Send') {
        submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
        submitBtn.title = 'Send message';
      }
    }

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
      chatBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const currentlyOpen = chatPopup && chatPopup.style.display === "block";
        toggleChat(!currentlyOpen);
      });
    }

    if (chatOverlay) chatOverlay.addEventListener("click", () => toggleChat(false));
    if (closeChatBtn) closeChatBtn.addEventListener("click", () => toggleChat(false));

    // Close chat when clicking outside the popup
    document.addEventListener("click", (e) => {
      if (!chatPopup || !chatBtn) return;
      
      const isPopupOpen = chatPopup.style.display === "block";
      if (!isPopupOpen) return;
      
      // Check if click is outside both the popup and the chat button
      if (!chatPopup.contains(e.target) && !chatBtn.contains(e.target)) {
        toggleChat(false);
      }
    });

    // Prevent clicks inside the popup from closing it
    if (chatPopup) {
      chatPopup.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

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
        const convId = h.conversation_id || "";
        const otherName = h.other_name || "Unknown";
        const itemTitle = h.item_title || "";
        const lastMessage = h.last_message || "";
        const unread = h.unread_count || 0;
        const avatar = h.other_avatar || "";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chat-head";
        btn.dataset.conv = convId;

        let avatarHtml = "";
        if (avatar) {
          avatarHtml = `<div class="avatar"><img src="${escapeHtml(avatar)}" alt="${escapeHtml(otherName)}"></div>`;
        } else {
          const initials = (otherName.split(" ").map(s => s[0] || "").slice(0,2).join("") || otherName.slice(0,1) || "U").toUpperCase();
          avatarHtml = `<div class="avatar fallback">${escapeHtml(initials)}</div>`;
        }

        btn.innerHTML = `
          ${avatarHtml}
          <div class="head-main">
            <div class="head-title">${escapeHtml(otherName)}</div>
            <div class="head-item-title">${escapeHtml(itemTitle)}</div>
            <div class="head-sub">${escapeHtml(lastMessage)}</div>
          </div>
          ${unread ? `<div class="head-badge">${unread}</div>` : ""}
        `;

        btn.addEventListener("click", () => {
          clearSelectedHeads();
          btn.classList.add("selected");
          setPopupHeaderTitle(otherName, itemTitle);
          openConversation(convId);
        });

        chatList.appendChild(btn);
      });
    }

    function setPopupHeaderTitle(title, subtitle) {
      if (!chatPopup) return;
      const headerTitleEl = chatPopup.querySelector(".chat-header .title");
      if (!headerTitleEl) return;
      if (subtitle) {
        headerTitleEl.innerHTML = `${escapeHtml(title || '')} <span class="header-subtitle-sep">—</span> <span class="header-sub">${escapeHtml(subtitle)}</span>`;
      } else {
        headerTitleEl.textContent = title || "Chats";
      }
    }

    // inject delete button into chat header (if not present)
    function ensureDeleteButton() {
      if (!chatPopup) return;
      const header = chatPopup.querySelector(".chat-header");
      if (!header) return;
      if (header.querySelector("#deleteChatBtn")) return;

      const controlsDiv = document.createElement("div");
      controlsDiv.className = "chat-header-controls";

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.id = "deleteChatBtn";
      delBtn.title = "Delete conversation";
      delBtn.className = "delete-chat-btn";
      delBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>`;
      
      const closeBtn = header.querySelector("#closeChat");
      
      controlsDiv.appendChild(delBtn);
      if (closeBtn) {
        controlsDiv.appendChild(closeBtn);
      }
      
      header.appendChild(controlsDiv);

      delBtn.addEventListener("click", async () => {
        if (!activeConversation) {
          alert("No conversation selected to delete.");
          return;
        }
        const confirmDelete = confirm("Delete this conversation? This will remove all messages and cannot be undone.");
        if (!confirmDelete) return;

        try {
          const res = await fetch(`/api/chat/${activeConversation}/delete/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": getCookie("csrftoken"),
            },
            body: JSON.stringify({}),
          });
          const j = await res.json();
          if (res.ok && j && j.success) {
            // remove head element from list
            const headEl = document.querySelector(`.chat-head[data-conv="${activeConversation}"]`);
            if (headEl && headEl.parentNode) headEl.parentNode.removeChild(headEl);
            closeConversation();
            // reload heads to refresh list as well
            loadChatHeads();
          } else {
            console.warn("delete conversation failed", j);
            alert((j && j.error) || "Failed to delete conversation");
          }
        } catch (e) {
          console.error("delete conversation error", e);
          alert("Error deleting conversation");
        }
      });
    }

    async function openConversation(convId) {
      activeConversation = convId;
      ensureDeleteButton();

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

      if (channel) {
        try {
          channel.unsubscribe();
        } catch (err) {}
        channel = null;
      }

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
      
      // Remove delete button when closing
      const delBtn = document.querySelector("#deleteChatBtn");
      if (delBtn && delBtn.parentElement) {
        delBtn.parentElement.remove();
      }
    }

    function appendMessage(senderId, text, when, msgId) {
      if (!messagesEl) return;

      if (msgId && messagesEl.querySelector(`[data-msg-id="${msgId}"]`)) {
        return;
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
            appendMessage(CURRENT_USER_ID, txt, new Date().toISOString(), j && j.message ? j.message.id : undefined);
          }
        } catch (e) {
          console.error("post message error", e);
          appendMessage(CURRENT_USER_ID, txt, new Date().toISOString());
        }
      });
    }

    // Improved startChat: opens chat, waits for head to be rendered, selects it and opens conversation
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
          // open the chat popup and make sure heads are loaded
          toggleChat(true);

          const convId = j.conversation_id;

          // wait for the chat head element to appear, up to maxWait ms
          const maxWait = 3000; // ms
          const interval = 100; // ms
          let waited = 0;

          const findAndSelectHead = () => {
            const sel = document.querySelector(`.chat-head[data-conv="${convId}"]`);
            if (sel) {
              clearSelectedHeads();
              sel.classList.add("selected");
              const otherName = sel.querySelector(".head-title")?.textContent || "Conversation";
              // set header title and open conversation
              setPopupHeaderTitle(otherName);
              openConversation(convId);
              return true;
            }
            return false;
          };

          // immediate attempt (in case heads already loaded)
          if (findAndSelectHead()) return;

          // poll until found or timeout
          const poll = setInterval(() => {
            waited += interval;
            if (findAndSelectHead()) {
              clearInterval(poll);
            } else if (waited >= maxWait) {
              clearInterval(poll);
              // fallback: still open conversation even if head is not in DOM
              openConversation(convId);
            }
          }, interval);
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

    console.debug("chat.js initialized", {
      SUPABASE_URL: SUPABASE_URL ? "ok" : "missing",
      SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? "ok" : "missing",
      CURRENT_USER_ID: CURRENT_USER_ID ? "ok" : "missing",
      elements: { chatBtn: !!chatBtn, chatPopup: !!chatPopup, chatList: !!chatList, chatForm: !!chatForm },
    });
  });
})();