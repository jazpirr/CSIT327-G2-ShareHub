function showSuccessPopup() {
    document.getElementById("successOverlay").style.display = "block";
    document.getElementById("successPopup").style.display = "flex";
}

function closeSuccessPopup() {
    document.getElementById("successOverlay").style.display = "none";
    document.getElementById("successPopup").style.display = "none";
}

// Check if logout success flag exists in URL
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("logout_success") === "1") {
        showSuccessPopup();
    }
});
