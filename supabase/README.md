# Supabase · Yamilet Academy

Este directorio es la fuente reproducible de cambios de backend de Yamilet Academy.

## Proyecto

Backend dedicado para la evolución de Yamilet: proyecto Supabase con referencia `pvpgvzaasnkukhoziiyg` (nombre histórico: `aula-compas`). Está separado de Academia AG y de Compás One.

Workspace inicial:
- `Academia Yamilet`
- slug `yamilet-mes`

## Estructura

- `migrations/`: DDL reproducible y versionado. Todo cambio estructural nuevo debe vivir aquí.
- `functions/`: Edge Functions mantenidas como código fuente.
- `sql/`: material legado/plantillas previas. No usar como ruta principal para nuevos cambios estructurales.

## Convención de migraciones

Formato obligatorio:

`YYYYMMDDHHMMSS_nombre_descriptivo.sql`

Flujo:

1. crear/editar la migración en una rama `feature/*`;
2. revisar el SQL;
3. aplicar exactamente ese DDL al proyecto Supabase;
4. correr Security Advisors;
5. abrir PR;
6. verificar y fusionar a `main`.

No ejecutar DDL manual que no quede representado por una migración equivalente.

## Separación de responsabilidades

Yamilet Academy administra autenticación académica, cursos, progreso, evaluaciones, biblioteca, eventos, certificados, soporte, compras y accesos.

Compás One administra CRM, leads, conversaciones, campañas, ventas y seguimiento comercial. No se compartirán tablas entre ambos sistemas. La integración futura será por API/eventos.

## Seguridad

Nunca publicar:
- `service_role`;
- DB password;
- JWT secret;
- secretos de Edge Functions;
- credenciales de integraciones.

El frontend solo puede usar URL del proyecto y clave publicable. Las operaciones sensibles se protegen con RLS y, cuando corresponda, RPC/Edge Functions autorizadas.

## Referencias

- `/docs/YAMILET-ACADEMY-AUDIT-P0.md`
- `/docs/YAMILET-ACADEMY-ARCHITECTURE.md`
- `/SUPABASE-SECURITY-NOTES.md`
