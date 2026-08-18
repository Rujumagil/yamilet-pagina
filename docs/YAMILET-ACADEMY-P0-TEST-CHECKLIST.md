# Checklist de pruebas · P0 Auth + Evaluaciones

## Auth
- Login válido abre dashboard solo con acceso Yamilet.
- Login válido sin curso/membresía muestra `Acceso pendiente`.
- Magic link no crea usuarios nuevos.
- Recuperación envía correo al email registrado.
- Enlace de recuperación abre formulario de nueva contraseña.
- Contraseñas menores de 8 caracteres se rechazan en UI.
- Confirmación distinta se rechaza en UI.
- Cerrar sesión regresa al login.

## Reservaciones
- Owner/admin ve panel de clase gratis.
- Alumno no ve panel administrativo.
- Se listan `booking_date`, `full_name`, `email`, `status`.
- Estados válidos: requested, confirmed, completed, cancelled.

## Evaluaciones
- Alumno puede leer texto/opciones de evaluaciones publicadas de cursos con acceso.
- Alumno no puede consultar `assessment_options.is_correct`.
- Alumno no puede escribir `score`, `passed`, `is_correct` o `points_awarded` directamente.
- Intentos y respuestas se procesan mediante RPC.
- Staff solo administra evaluaciones de cursos que puede gestionar dentro de su workspace.
- Usuario anónimo no opera tablas de evaluaciones.
