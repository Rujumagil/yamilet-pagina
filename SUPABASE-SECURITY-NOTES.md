# Preflight de seguridad Supabase

Revisión realizada sobre la infraestructura `aula-compas` antes de conectar Yamilet. No se hicieron cambios de producción.

## Correcto para el modelo Yamilet
- Existe separación por `workspace_id` en workspaces, contactos, cursos/productos donde corresponde.
- Existen políticas RLS para miembros de workspace, contactos, cursos, inscripciones y progreso.
- La landing no necesita acceso directo a tablas: utilizará una Edge Function pública validada y el servidor resolverá el workspace Yamilet.

## Advertencias que deben revisarse antes de entrega productiva
Supabase Security Advisor reporta funciones `SECURITY DEFINER` ejecutables por usuarios autenticados. Debe confirmarse que cada una valida internamente permisos o revocar `EXECUTE` cuando no sea necesario:
- `admin_change_student_access_status`
- `admin_grant_product_access`
- `admin_set_user_role`
- `delete_managed_course`
- `is_aula_admin`
- `is_super_admin`
- `is_workspace_member`

También aparece desactivada la protección contra contraseñas filtradas en Supabase Auth.

## Criterio de entrega
No considerar Academia MES lista para producción hasta:
1. Revisar los permisos de las funciones anteriores.
2. Activar protección de contraseñas filtradas si el plan/configuración lo permite.
3. Ejecutar Security Advisor después de cualquier cambio DDL.
4. Probar con dos usuarios de workspaces diferentes que no exista lectura/escritura cruzada.
5. Confirmar que ninguna credencial privada esté en GitHub ni JS público.

Referencia de Supabase para el lint de funciones SECURITY DEFINER: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
