// static/js/respond_request.js
document.addEventListener("DOMContentLoaded", () => {
  function getCookie(name) {
    const v = `; ${document.cookie}`;
    const parts = v.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  const RESPOND_URL = window.RESPOND_URL || "/api/request/respond/";

  // Use global popup helpers when available; fallback to confirm/alert
  const showConfirmPopup = window.showConfirmPopup || (async (t, m, yl, nl) => confirm(m));
  const showMessagePopup = window.showMessagePopup || ((t, m, o = {}) => alert(m));

  async function handleRespond(requestId, action, li) {
    if (!li) return;
    const confirmMsg =
      action === "approve"
        ? "Approve this borrowing request?"
        : "Deny this borrowing request?";

    const ok = await showConfirmPopup(
      action === "approve" ? "Approve Request" : "Deny Request",
      confirmMsg,
      action === "approve" ? "Approve" : "Deny",
      "Cancel"
    );
    if (!ok) return;

    const approveBtn = li.querySelector(".btn-approve");
    const denyBtn = li.querySelector(".btn-deny");
    const statusSpan = li.querySelector(`#status-${requestId}`) || li.querySelector(".req-status");

    if (approveBtn) { approveBtn.disabled = true; approveBtn.dataset.prevText = approveBtn.textContent; approveBtn.textContent = "Processing..."; }
    if (denyBtn)    { denyBtn.disabled = true; denyBtn.dataset.prevText = denyBtn.textContent; denyBtn.textContent = "Processing..."; }

    try {
      const resp = await fetch(RESPOND_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ request_id: requestId, action }),
      });

      const data = await resp.json().catch(()=>({}));
      if (!resp.ok || !data.success) {
        const msg = (data && data.message) ? data.message : "Failed to update request.";
        throw new Error(msg);
      }

      const newStatus = data.status || (action === "approve" ? "approved" : "denied");
      if (statusSpan) {
        statusSpan.textContent = newStatus;
        statusSpan.style.color = newStatus === "approved" ? "green" : newStatus === "denied" ? "red" : "#555";
      }

      // animate & remove
      li.style.transition = "opacity 220ms ease, height 220ms ease";
      li.style.opacity = "0";
      li.style.height = "0";
      setTimeout(() => li.remove(), 240);

      showMessagePopup(
        newStatus === "approved" ? "Request Approved" : "Request Denied",
        newStatus === "approved"
          ? "You approved the request. The borrower will see this item in their Currently Borrowed Items."
          : "You denied the request. The requester has been notified.",
        { autoCloseMs: 3500 }
      );
    } catch (err) {
      console.error(err);
      if (approveBtn) { approveBtn.disabled = false; approveBtn.textContent = approveBtn.dataset.prevText || "Approve"; }
      if (denyBtn)    { denyBtn.disabled = false; denyBtn.textContent = denyBtn.dataset.prevText || "Deny"; }

      showMessagePopup("Error", err.message || "Failed to process request.", { autoCloseMs: 5000 });
    }
  }

  // Delegated click listener
  document.addEventListener("click", (e) => {
    const approve = e.target.closest && e.target.closest(".btn-approve");
    const deny = e.target.closest && e.target.closest(".btn-deny");
    if (approve) {
      const li = approve.closest(".incoming-request-row") || approve.closest(".incoming-request") || approve.closest("li");
      const id = approve.dataset.requestId;
      handleRespond(id, "approve", li);
    } else if (deny) {
      const li = deny.closest(".incoming-request-row") || deny.closest(".incoming-request") || deny.closest("li");
      const id = deny.dataset.requestId;
      handleRespond(id, "deny", li);
    }
  });
});
