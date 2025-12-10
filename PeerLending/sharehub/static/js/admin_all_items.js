(function () {

    // CSRF helper
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    const csrftoken = getCookie("csrftoken") || window.CSRF_TOKEN;

    // Build delete URL
    function buildDeleteUrl(itemId) {
        return ADMIN_DELETE_BASE + itemId + "/";
    }

    // Search filtering
    const searchInput = document.getElementById("itemSearch");
    const statusFilter = document.getElementById("statusFilter");
    const itemsGrid = document.getElementById("itemsGrid");

    function applyFilters() {
        const search = searchInput.value.toLowerCase().trim();
        const status = statusFilter.value;

        document.querySelectorAll(".item-card").forEach(card => {
            const title = card.dataset.title;
            const owner = card.dataset.owner;
            const cardStatus = card.dataset.status;

            const matchesSearch =
                title.includes(search) ||
                owner.includes(search);

            const matchesStatus =
                status === "all" || status === cardStatus;

            card.style.display = (matchesSearch && matchesStatus) ? "block" : "none";
        });
    }

    searchInput.addEventListener("input", applyFilters);
    statusFilter.addEventListener("change", applyFilters);


    // Confirm + delete
    document.addEventListener("click", async function (e) {
        const btn = e.target.closest(".btn-delete-item-admin");
        if (!btn) return;

        const itemId = btn.dataset.itemId;
        const url = buildDeleteUrl(itemId);

        const confirmDelete = confirm("Delete this item permanently?");
        if (!confirmDelete) return;

        btn.disabled = true;
        btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Deleting...";

        try {
            const resp = await fetch(url, {
                method: "POST",
                headers: {
                    "X-CSRFToken": csrftoken
                }
            });

            const data = await resp.json();

            if (!data.success) {
                alert("Failed: " + (data.error || "Could not delete"));
                btn.disabled = false;
                btn.innerHTML = "<i class='fas fa-trash'></i> Delete";
                return;
            }

            // Animate removal
            const card = btn.closest(".item-card");
            card.style.opacity = "0";
            card.style.transform = "scale(0.9)";
            setTimeout(() => card.remove(), 250);

        } catch (err) {
            console.error(err);
            alert("Network error.");
            btn.disabled = false;
        }
    });

})();
