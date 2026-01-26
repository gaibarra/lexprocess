# api_v1/permissions.py
from rest_framework import permissions
from users.models import RolUsuario
from despachos.models import Despacho  # Import faltante

class IsAdminOrRelatedDespacho(permissions.BasePermission):
    """
    Permiso para permitir acceso de LECTURA solo a admins o usuarios del mismo despacho.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        user_despacho = request.user.profile.despacho if hasattr(request.user, 'profile') else None
        if not user_despacho:
            return False
        
        obj_despacho = None
        if isinstance(obj, Despacho):
            obj_despacho = obj
        elif hasattr(obj, 'despacho'):
            obj_despacho = obj.despacho
        elif hasattr(obj, 'caso') and hasattr(obj.caso, 'despacho'):
            obj_despacho = obj.caso.despacho
        
        return obj_despacho == user_despacho

class IsAdminOrOwnerOfObject(permissions.BasePermission):
    """
    Permiso personalizado que permite la acción de ESCRITURA si:
    - El usuario es staff (superadmin).
    - El usuario es Administrador de su despacho.
    - El usuario es el "propietario" directo del objeto
      (ej: abogado_asignado, responsable, cargado_por).
    """
    def has_object_permission(self, request, view, obj):
        # El acceso de lectura se maneja por IsAdminOrRelatedDespacho en la vista
        if request.method in permissions.SAFE_METHODS:
            return True

        # El staff puede hacer cualquier cosa
        if request.user.is_staff:
            return True
        
        # El admin del despacho puede modificar objetos de su despacho
        if hasattr(request.user, 'profile') and request.user.profile.rol == RolUsuario.ADMINISTRADOR:
            user_despacho = request.user.profile.despacho
            obj_despacho = getattr(obj, 'despacho', getattr(getattr(obj, 'caso', None), 'despacho', None))
            if user_despacho and obj_despacho and user_despacho == obj_despacho:
                return True

        # Comprobar si el usuario es el propietario directo
        owner_fields = ['abogado_asignado', 'responsable', 'cargado_por', 'user']
        for field in owner_fields:
            if hasattr(obj, field) and getattr(obj, field) == request.user:
                return True
        
        return False