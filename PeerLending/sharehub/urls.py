from django.urls import path
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
]
 