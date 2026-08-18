# Yamilet Academy · P0 Auth + Evaluaciones

## Implementado
- Recuperación de contraseña con `resetPasswordForEmail` y pantalla para establecer nueva contraseña.
- Magic link conserva `shouldCreateUser: false`.
- Un usuario autenticado sin membresía de staff ni curso visible no entra al dashboard: ve `Acceso pendiente`.
- Los controles administrativos de reservaciones solo se muestran a owner/admin de Yamilet o administrador de plataforma.
- El panel de reservas usa el contrato real de `free_class_bookings`: `booking_date`, `full_name` y estado inicial `requested`.
- Evaluaciones aisladas por curso/workspace mediante `private.can_manage_academy_course`.
- `assessment_options.is_correct` no tiene permiso SELECT para `authenticated`.
- `assessment_attempts` y `assessment_answers` no admiten INSERT/UPDATE/DELETE directos desde `authenticated`.
- Inicio de intento, guardado de respuestas, entrega y calificación permanecen detrás de RPC seguras.
- `anon` no tiene permisos sobre el motor de evaluaciones.

## Validación backend
- Migración `yamilet_academy_assessment_security` aplicada correctamente.
- Security Advisor posterior: sin nuevas incidencias derivadas del cambio.
- Permanece el aviso de Supabase Auth: Leaked Password Protection desactivado.

## Siguiente contrato P0
Cerrar el flujo `courses -> enrollments -> modules -> lessons -> lesson_progress` y exponer un resumen de progreso seguro para el dashboard del alumno.
