document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("reportIssueModal");
  const closeBtn = document.getElementById("reportModalClose");
  const cancelBtn = document.getElementById("reportCancelBtn");
  const form = document.getElementById("reportIssueForm");
  const statusBox = document.getElementById("reportStatus");
  const submitBtn = document.getElementById("reportSubmitBtn");

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  function openModal(requestId, itemId) {
    const reqInput = document.getElementById("report_request_id");
    const itemInput = document.getElementById("report_item_id");
    if (reqInput) reqInput.value = requestId || "";
    if (itemInput) itemInput.value = itemId || "";
    statusBox.style.display = "none";
    statusBox.textContent = "";
    modal.style.display = "flex";
  }

  function closeModal() {
    modal.style.display = "none";
  }

  // Bind report buttons (they must have data-request-id and data-item-id)
  document.querySelectorAll(".report-issue-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const reqId = btn.dataset.requestId || "";
      const itemId = btn.dataset.itemId || "";
      openModal(reqId, itemId);
    });
  });

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusBox.style.display = "none";
    statusBox.textContent = "";

    const data = {
      request_id: document.getElementById("report_request_id")?.value || null,
      item_id: document.getElementById("report_item_id")?.value || null,
      issue_type: document.getElementById("report_issue_type")?.value || "other",
      title: document.getElementById("report_title")?.value.trim() || "",
      description: document.getElementById("report_desc")?.value.trim() || ""
    };

    if (!data.title && !data.description) {
      statusBox.style.display = "block";
      statusBox.style.color = "red";
      statusBox.textContent = "Please enter a title or description.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
      const resp = await fetch("/api/report-issue/", {
        method: "POST",
        credentials: "same-origin", // IMPORTANT: sends cookies/session to Django
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken") || ""
        },
        body: JSON.stringify(data)
      });

      // Handle auth / redirect cases explicitly
      if (resp.status === 401) {
        statusBox.style.display = "block";
        statusBox.style.color = "red";
        statusBox.textContent = "You must be signed in to report an issue.";
        return;
      }

      // Try to parse JSON, but gracefully handle non-JSON (HTML error pages)
      let result = null;
      try {
        result = await resp.json();
      } catch (parseErr) {
        console.warn("Non-JSON response from /api/report-issue/", parseErr);
        statusBox.style.display = "block";
        statusBox.style.color = "red";
        statusBox.textContent = `Server returned status ${resp.status}.`;
        return;
      }

      if (resp.ok && result && result.success) {
        statusBox.style.display = "block";
        statusBox.style.color = "green";
        statusBox.textContent = "Issue report submitted.";
        console.log("Report saved:", result.report || result);
        form.reset();
        setTimeout(() => closeModal(), 900);
      } else {
        statusBox.style.display = "block";
        statusBox.style.color = "red";
        statusBox.textContent = (result && result.message) ? result.message : `Error: ${resp.status}`;
        console.warn("Report failed:", result);
      }
    } catch (err) {
      console.error("Network or unexpected error while submitting report:", err);
      statusBox.style.display = "block";
      statusBox.style.color = "red";
      statusBox.textContent = "Network error — check your connection or server logs.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Report";
    }
  });
});
