# Compás Control — endpoint agregado de Yamilet (NO DESPLEGADO)

## Objetivo
Exponer únicamente el **total de inscripciones por estado** en el workspace académico `yamilet-mes`, sin enviar datos personales ni modificar tablas.

Fuente: `courses.workspace_id` y `enrollments.course_id` del Supabase académico dedicado. Las inscripciones `cancelled` se presentan al panel como `revoked`; es una traducción de etiqueta, **no** una modificación de datos.

## Ruta real de Supabase Edge Functions
`GET https://pvpgvzaasnkukhoziiyg.supabase.co/functions/v1/compas-control-yamilet-summary`

Esta ruta no estará disponible hasta desplegar la función. No debe confundirse con el endpoint `/api/compas-control/...` previamente propuesto.

## Autenticación
- **Solo servidor-servidor**: bearer token aleatorio de 32+ caracteres almacenado como secreto en ambos entornos bajo `COMPAS_CONTROL_YAMILET_METRICS_TOKEN`.
- La función devuelve 401 si falta o es incorrecto, rechaza peticiones con `Origin` y métodos distintos de GET. No concede cabeceras CORS.
- Para aceptar tokens propios, Supabase debe ejecutar esta función con `verify_jwt=false` (configuración de la función, **no** de las demás). Esto **no** convierte la función en pública: su propia comprobación del secreto continúa siendo obligatoria. No publicar hasta verificar controles/rate limiting en el entorno autorizado.
- En el servidor de Evolution, la URL y el token permanecen en secretos; la activación sigue en `COMPAS_CONTROL_YAMILET_ENABLED=false` hasta completar pruebas reales.
- `SUPABASE_SERVICE_ROLE_KEY` vive exclusivamente en el runtime seguro de la Edge Function académica. Jamás se traslada a Evolution ni al navegador.
- No reutilizar tokens de alumnos, claves publicables, tokens de WhatsApp o credenciales comerciales.

## Contrato JSON de respuesta
```json
{
  "schema_version": 1,
  "workspace_slug": "yamilet-mes",
  "checked_at": "2026-11-13T16:00:00.000Z",
  "counts": {
    "active": 0,
    "paused": 0,
    "completed": 0,
    "revoked": 0
  }
}
```
Los ceros de este ejemplo **no son cifras reales**.

## Límites y verificación
- Solo cuenta inscripciones de cursos vinculados al workspace académico `yamilet-mes`.
- Máximo 500 cursos. Si los supera, devuelve error en lugar de totales parciales.
- Cuenta con `head:true,count:exact` sin recuperar perfiles ni filas de alumnos; no inserta, actualiza ni elimina.
- Si falla cualquier consulta, responde 503 sin cifras parciales.
- No verifica el estado de `student_access`; el alcance son **inscripciones** y sus estados, no disponibilidad real de la cuenta ni acceso individual.
- Los tests automatizados usan dobles de base de datos. Antes de producción: probar secreto incorrecto, autorización, tenant ajeno, saturación, logs sin tokens, rotación de claves y lectura con la base real con permiso expreso.
- `verify_jwt=false` abre el ingreso hasta el código de la función: controlar intentos, alertas y rotación antes de activar.

## Pasos futuros (no ejecutados)
1. Revisar y aprobar el PR y el CI.
2. Validar en Supabase el esquema efectivo; el acceso SQL por la conexión vinculada anteriormente falló por autenticación.
3. Crear el secreto de lectura con un generador criptográficamente seguro, en ambos runtimes sin guardarlo en GitHub.
4. Configurar y desplegar solo esta función con validación de JWT de plataforma deshabilitada **únicamente para ella**, revisar trazas y configuración. No desplegar antes de autorizarlo expresamente.
5. Verificar un 401 con token incorrecto, un 200 con token válido, que el conteo no incluya otros workspaces y que `checked_at` sea reciente.
6. Habilitar explícitamente el lector de Evolution, con monitorización, límites de llamadas y plan de reversión.
