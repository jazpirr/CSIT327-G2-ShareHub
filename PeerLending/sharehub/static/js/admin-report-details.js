// static/js/admin-report-details.js - FIXED VERSION

(function () {
    'use strict';

    console.log("✅ admin-report-details.js loaded");
    
    // Use consistent URL variable
    const REPORT_DETAILS_URL = window.ADMIN_REPORT_DETAILS_URL || '/admin/api/report-details/';
    console.log("API URL:", REPORT_DETAILS_URL);

    // DOM Elements
    const modal = document.getElementById('report-details-modal');
    if (!modal) {
        console.error("❌ Modal not found!");
        return;
    }
    const modalBackdrop = modal.querySelector('.modal-backdrop');
    const modalCloseBtns = modal.querySelectorAll('.modal-close, .close-modal');
    const modalContent = modal.querySelector('.report-detail-content');

    // Report data from template
    const reportsData = JSON.parse(document.getElementById('reports-data')?.textContent || '[]');
    console.log("Loaded reports data:", reportsData.length, "reports");

    // Get CSRF token
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // Format date
    function formatDate(dateString) {
        if (!dateString) return 'N/A';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    }

    // Create status badge HTML
    function getStatusBadge(status) {
        const statusLower = String(status).toLowerCase();

        if (statusLower === 'in progress' || statusLower === 'in_progress') {
            return '<span class="status-badge progress"><i class="fas fa-spinner"></i> In Progress</span>';
        } else if (statusLower === 'resolved') {
            return '<span class="status-badge resolved"><i class="fas fa-check-circle"></i> Resolved</span>';
        } else {
            return '<span class="status-badge open"><i class="fas fa-exclamation-circle"></i> Open</span>';
        }
    }

    // Create type badge HTML
    function getTypeBadge(type, itemId, requestId) {
        if (itemId) {
            return '<span class="type-badge item-type"><i class="fas fa-box"></i> Item Issue</span>';
        } else if (requestId) {
            return '<span class="type-badge request-type"><i class="fas fa-handshake"></i> Request Issue</span>';
        } else {
            return '<span class="type-badge other-type"><i class="fas fa-exclamation-triangle"></i> General Issue</span>';
        }
    }

    // Show modal
    function showModal() {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        console.log("Modal shown");
    }

    // Hide modal
    function hideModal() {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        console.log("Modal hidden");
    }

    // Load report data - FIXED URL
    async function loadReportDetails(reportId) {
        console.log("📤 Loading report details for:", reportId);
        const url = `${REPORT_DETAILS_URL}${reportId}/`;
        console.log("Full URL:", url);
        
        try {
            const csrftoken = getCookie('csrftoken');
            console.log("CSRF Token exists:", !!csrftoken);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-CSRFToken': csrftoken,
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });

            console.log("Response status:", response.status);
            console.log("Response headers:", Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Response error text:", errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Response data:", data);
            return data;
            
        } catch (error) {
            console.error('❌ Error fetching report details:', error);

            // Fallback to template data if available
            const report = reportsData.find(r => r.report_id == reportId || r.id == reportId);
            if (report) {
                console.log("Using fallback template data");
                return {
                    success: true,
                    report: report
                };
            }

            return {
                success: false,
                error: 'Could not load report details: ' + error.message
            };
        }
    }

    // Render report details
    function renderReportDetails(data) {
        if (!data.success || !data.report) {
            return `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h4>Unable to Load Report</h4>
                    <p>${data.error || 'The report details could not be loaded. Please try again.'}</p>
                </div>
            `;
        }

        const report = data.report;
        const isItemIssue = report.item_id || (report.reference && report.reference.includes('Item'));
        const isRequestIssue = report.request_id || (report.reference && report.reference.includes('Request'));

        return `
            <div class="report-detail-view">
                <!-- Report Header -->
                <div class="detail-header">
                    <div class="detail-title-section">
                        <h4 class="detail-title">${report.title || 'Untitled Report'}</h4>
                        <div class="detail-subtitle">
                            <span class="report-id">Report #${report.report_id || report.id || 'N/A'}</span>
                            <span class="report-date">${formatDate(report.created_at)}</span>
                        </div>
                    </div>
                    <div class="detail-status-section">
                        ${getStatusBadge(report.status)}
                        ${getTypeBadge(report.type, report.item_id, report.request_id)}
                    </div>
                </div>
                
                <!-- Report Description -->
                <div class="detail-section">
                    <h5><i class="fas fa-align-left"></i> Description</h5>
                    <div class="detail-description">
                        ${report.description || 'No description provided.'}
                    </div>
                </div>
                
                <!-- Report Details Grid -->
                <div class="detail-grid">
                    <div class="detail-card">
                        <div class="detail-card-icon">
                            <i class="fas fa-user-circle"></i>
                        </div>
                        <div class="detail-card-content">
                            <label>Reported By</label>
                            <div class="detail-card-value">
                                ${report.reported_by_email || report.reported_by || 'Unknown'}
                            </div>
                            ${report.reported_by_name ? `<div class="detail-card-sub">${report.reported_by_name}</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="detail-card">
                        <div class="detail-card-icon">
                            <i class="fas fa-calendar"></i>
                        </div>
                        <div class="detail-card-content">
                            <label>Report Date</label>
                            <div class="detail-card-value">
                                ${formatDate(report.created_at)}
                            </div>
                            ${report.updated_at ? `<div class="detail-card-sub">Updated: ${formatDate(report.updated_at)}</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="detail-card">
                        <div class="detail-card-icon">
                            <i class="fas fa-link"></i>
                        </div>
                        <div class="detail-card-content">
                            <label>Reference</label>
                            <div class="detail-card-value">
                                ${report.reference ||
            (report.item_id ? `Item #${report.item_id}` :
                report.request_id ? `Request #${report.request_id}` :
                    'No reference')}
                            </div>
                            ${report.item_title ? `<div class="detail-card-sub">${report.item_title}</div>` : ''}
                            ${report.request_title ? `<div class="detail-card-sub">${report.request_title}</div>` : ''}
                        </div>
                    </div>
                    
                    ${report.priority ? `
                    <div class="detail-card">
                        <div class="detail-card-icon">
                            <i class="fas fa-flag"></i>
                        </div>
                        <div class="detail-card-content">
                            <label>Priority</label>
                            <div class="detail-card-value priority-${report.priority.toLowerCase()}">
                                ${report.priority}
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <!-- Additional Information -->
                <div class="detail-section">
                    <h5><i class="fas fa-info-circle"></i> Additional Information</h5>
                    <div class="detail-info-grid">
                        ${report.category ? `
                        <div class="info-item">
                            <label>Category:</label>
                            <span>${report.category}</span>
                        </div>
                        ` : ''}
                        
                        ${report.assigned_to ? `
                        <div class="info-item">
                            <label>Assigned To:</label>
                            <span>${report.assigned_to}</span>
                        </div>
                        ` : ''}
                        
                        ${report.resolution_notes ? `
                        <div class="info-item full-width">
                            <label>Resolution Notes:</label>
                            <div class="resolution-notes">${report.resolution_notes}</div>
                        </div>
                        ` : ''}
                        
                        ${report.attachments && report.attachments.length > 0 ? `
                        <div class="info-item full-width">
                            <label>Attachments:</label>
                            <div class="attachments-list">
                                ${report.attachments.map(att => `
                                    <a href="${att.url}" target="_blank" class="attachment-item">
                                        <i class="fas fa-paperclip"></i>
                                        ${att.name}
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Action Buttons (if applicable) -->
                ${report.status && !report.status.includes('resolved') ? `
                <div class="detail-actions">
                    <button class="action-btn progress-btn" data-report-id="${report.report_id || report.id}" data-action="in_progress">
                        <i class="fas fa-spinner"></i>
                        Start Progress
                    </button>
                    <button class="action-btn resolve-btn" data-report-id="${report.report_id || report.id}" data-action="resolved">
                        <i class="fas fa-check-circle"></i>
                        Mark Resolved
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    }

    // Event Listeners
    document.addEventListener('DOMContentLoaded', function () {
        console.log("✅ DOM loaded, setting up event listeners");
        
        // View Details button click - using event delegation
        document.addEventListener('click', async function (e) {
            const viewBtn = e.target.closest('.view-btn');
            if (!viewBtn) return;
            
            e.preventDefault();
            e.stopPropagation();

            const reportId = viewBtn.getAttribute('data-report-id');
            console.log("🟢 View Details clicked for report:", reportId);
            if (!reportId) return;

            // Show loading state using the existing templates
            document.querySelector('.detail-loading-template').style.display = 'block';
            document.querySelector('.detail-error-template').style.display = 'none';
            document.querySelector('.detail-success-template').style.display = 'none';
            
            showModal();

            // Load report data
            const reportData = await loadReportDetails(reportId);
            console.log("Report data loaded:", reportData);

            // Render the data
            const successTemplate = document.querySelector('.detail-success-template');
            successTemplate.innerHTML = renderReportDetails(reportData);
            
            // Switch templates
            document.querySelector('.detail-loading-template').style.display = 'none';
            successTemplate.style.display = 'block';
            
            // Re-attach action button handlers
            attachActionButtonHandlers();
        });

        // Close modal events
        modalBackdrop.addEventListener('click', hideModal);
        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', hideModal);
        });

        // Close on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                hideModal();
            }
        });

        // Prevent modal close when clicking inside modal content
        modalContent.addEventListener('click', function (e) {
            e.stopPropagation();
        });
        
        console.log("Event listeners set up");
    });

    // Attach action button handlers inside modal
    function attachActionButtonHandlers() {
        const actionButtons = document.querySelectorAll('.action-btn');
        console.log("Attaching handlers to", actionButtons.length, "action buttons");

        actionButtons.forEach(button => {
            button.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                const reportId = this.getAttribute('data-report-id');
                const action = this.getAttribute('data-action');
                console.log("Action button clicked:", reportId, action);

                if (!reportId || !action) return;

                // Trigger the existing status update functionality
                const event = new CustomEvent('statusUpdateRequested', {
                    detail: { reportId, action },
                    bubbles: true
                });

                this.dispatchEvent(event);

                // Close modal after action
                setTimeout(() => {
                    hideModal();
                }, 500);
            });
        });
    }

    // Expose functions for debugging
    window.debugReportDetails = {
        loadReportDetails,
        showModal,
        hideModal
    };
    
    console.log("✅ admin-report-details.js initialized");
})();