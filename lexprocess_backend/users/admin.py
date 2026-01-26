from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import UserProfile

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Perfiles de Usuario'
    fk_name = 'user'

class CustomUserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'get_rol', 'get_despacho')
    list_select_related = ('profile',) # optimiza la query

    def get_rol(self, instance):
        return instance.profile.rol if hasattr(instance, 'profile') else None
    get_rol.short_description = 'Rol'

    def get_despacho(self, instance):
        return instance.profile.despacho if hasattr(instance, 'profile') and instance.profile.despacho else None
    get_despacho.short_description = 'Despacho'


admin.site.unregister(User) # Desregistrar el User admin por defecto
admin.site.register(User, CustomUserAdmin) # Registrar el User admin personalizado

# Si quieres un admin separado para UserProfile (además del inline)
# @admin.register(UserProfile)
# class UserProfileAdmin(admin.ModelAdmin):
#     list_display = ('user', 'rol', 'despacho', 'telefono')
#     search_fields = ('user__username', 'user__email', 'telefono')
#     list_filter = ('rol', 'despacho')