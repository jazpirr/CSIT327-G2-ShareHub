from django.urls import path, include
from django.shortcuts import redirect
from . import views

urlpatterns = [
    path('', lambda request: redirect('login')), 
    path('register/', views.register_view, name="register"),
    path('login/', views.login_view, name="login"),
    path('logout/', views.logout_view, name="logout"),
    path("home/", views.home, name="home"),
    path("profile/", views.profile, name="profile"),
    path("profile/edit/", views.edit_profile, name="edit_profile"),
    path("settings/", views.settings_view, name="settings"),
    path("admindashboard/", views.admin_dashboard, name="admin_dashboard"),
    path("settings/update_email/", views.update_email, name="update_email"),
    path('confirm-email/', views.confirm_email_change, name='confirm_email'),
    path("settings/update_password/", views.update_password, name="update_password"),
    path("forgot-password", views.forgot_password, name="forgot_password"),
    path("reset-password", views.reset_password_page, name="reset_password_page"),
    path("add-item/", views.add_item, name="add_item"),
    path("borrow_items/", views.borrow_items, name="borrow_items"),
    path("request-borrow/", views.create_request, name="request_borrow"),
    path('api/request/respond/', views.respond_request, name='api_respond_request'),
    path('return-items/', views.return_items, name='return_items'),
    path("save_visibility/", views.save_visibility, name="save_visibility"),
    path("save_contact/", views.save_contact, name="save_contact"), 
    path("notifications/mark-read/", views.mark_notifications_read, name="mark_notifications_read"),
    path("mark-returned/", views.mark_returned, name="mark_returned"),
    path('my-items/', views.my_items, name='my_items'),
    path('my-items/<str:item_id>/delete/', views.delete_item, name='delete_item'),
    path('item/<str:item_id>/edit/', views.edit_item, name='edit_item'),
    path('', include('chat.urls')),
    path('approve-requests/', views.approve_requests_view, name='approve_requests'),
    path('manage-users/', views.manage_users_view, name='manage_users'),
     path('reports/', views.admin_reports_view, name='admin_reports'),
    path('api/report-issue/', views.report_issue_api, name='report_issue_api'),
    path('reports/update-status/', views.admin_update_report_status, name='admin_update_report_status'),
    path('toggle-user-admin/', views.toggle_user_admin, name='toggle_user_admin'),
    path('toggle-block/', views.toggle_block_user, name='toggle_user_block'),
    
]
 
    

 