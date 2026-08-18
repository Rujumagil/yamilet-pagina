# Yamilet Academy — Auditoría P0

Fecha: 2026-08-18

Referencia funcional: Academia AG Business Networking, exclusivamente para arquitectura, UX, seguridad y madurez funcional. No se reutilizan identidad, cursos, alumnos, imágenes ni datos de AG.

## Estado real al iniciar P0

- Backend Supabase dedicado para la evolución de Yamilet: proyecto físico actualmente identificado como `aula-compas`, separado de Academia AG y de Compás One.
- Workspace Yamilet existente: `Academia Yamilet` / `yamilet-mes`.
- 1 miembro del workspace: propietario/administrador.
- 1 curso borrador: `Método MES®`.
- 0 módulos, 0 lecciones, 0 inscripciones y 0 filas de progreso para Yamilet.
- Supabase Auth ya está operativo y la academia pública ya tiene pantalla básica de inicio de sesión.
- La landing tiene agenda de clase gratuita conectada a Supabase.

## Mapa de auditoría

| Área | YA EXISTE | SE PUEDE REUTILIZAR | HAY QUE MODIFICAR | HAY QUE CREAR | RIESGO | PRIORIDAD |
|---|---|---|---|---|---|---|
| Supabase / proyecto | Sí | Proyecto actual separado de AG | Formalizarlo como backend dedicado de Yamilet y retirar dependencias/documentación antigua de Aula Compás | Convención de migraciones reproducibles | Medio: quedan estructuras históricas de otros workspaces | P0 |
| Auth | Sí | Supabase Auth, sesión persistente y magic link | Recuperación y cambio de contraseña con URL productiva | Flujo completo registro → confirmación → recuperación | Medio | P0 |
| Roles | Sí | `profiles.role`: student/instructor/admin | Revisar alcance de admin global frente a workspace | Matriz de permisos por workspace | Alto mientras convivan workspaces antiguos | P0 |
| Workspaces | Sí | `workspaces`, `workspace_members` | Estandarizar permisos y nomenclatura Yamilet | Configuración administrable del workspace | Medio | P0 |
| Cursos | Sí | `courses` y borrador Método MES | Adaptar editor y tarjetas premium | Contenido oficial cuando sea entregado | Bajo | P0/P1 |
| Módulos | Sí | `modules` | Ningún contenido todavía | Módulos oficiales de MES | Bajo; no inventar contenido | P0/P1 |
| Lecciones | Sí | `lessons` con video, texto, audio, descarga, quiz, live | Ocultar proveedores/URLs técnicas y añadir experiencia de curso | Reproductor 16:9 + modo cine | Medio | P1 |
| Inscripciones | Sí | `enrollments` con unicidad alumno/curso | Validar provisioning desde productos/accesos | Flujo de asignación administrativa | Medio | P0 |
| Progreso | Sí | `lesson_progress`, segundos, completado, updated_at | Endurecer RLS para impedir progreso fuera de cursos autorizados | Cálculo de porcentaje/continuar aprendiendo | Alto si no se valida inscripción en escritura | P0 |
| Evaluaciones | Sí | Motor canónico `assessments`, `assessment_questions`, `assessment_options`, `assessment_attempts`, `assessment_answers` | Revisar privilegios y alcance de instructor/admin por workspace | UI alumno + autoría admin + grading seguro | Alto | P0/P1 |
| Biblioteca | Sí parcial | `resources`, `resource_access`, `product_contents` | Diseñar acceso privado y UX | Buscador/filtros/biblioteca protegida | Medio | P1 |
| Certificados | Sí parcial | `certificates` | Auditar reglas de emisión y privacidad | UI, PDF, verificación pública por folio/código | Medio | P2 |
| Calendario | No completo | Arquitectura general puede reutilizarse | — | `events`, `event_registrations`, UI calendario | Bajo | P2 |
| Soporte | No completo | — | — | tickets, respuestas, estados, historial | Bajo | P2 |
| Productos / compras | Sí | `products`, `orders` | Separar producto/compra/acceso/curso de forma explícita en UX | Automatización de otorgamiento de acceso | Medio | P3 |
| Accesos | Sí | `student_access`, `access_history` | Normalizar estados y operaciones | Panel activar/suspender/reactivar/revocar | Medio | P3 |
| Auditoría | Sí parcial | `access_history`, eventos de integración | Unificar eventos administrativos relevantes | Vista Registros del admin | Medio | P3/P4 |
| Dashboard alumno | Básico | Login y carga de cursos | Rehacer navegación; hoy es prototipo | Inicio, Mis cursos, Evaluaciones, Biblioteca, Calendario, Certificados, Ayuda, Perfil, Explorar | Alto por diferencia con objetivo | P1 |
| Admin | Básico | Acceso owner/admin y reservas clase gratis | Eliminar navegación basada en scroll | Pestañas reales Resumen/Alumnos/Compras/Accesos/Registros/Academia | Alto | P4 |
| CRM | Existe legado técnico | No debe usarse como CRM de Yamilet Academy | La agenda actual todavía crea/actualiza `contacts`; debe desacoplarse | Eventos de salida futura hacia Compás One | Alto: duplicación de responsabilidades | P0 |
| Compás One | Separado | Integración futura por API/eventos | No conectar tablas directamente | Outbox/eventos `student.*`, `order.*`, `access.*`, etc. | Medio | P3/P5 |
| PWA | No en Academia | — | — | manifest, service worker, iconos, standalone, estrategia de caché | Medio | P5 |
| Responsive | Parcial | Landing y login base | Auditar academia completa 360–1920 px | Navegación móvil y tablas adaptativas | Medio | P5 |
| Idiomas | Landing ES/IT | Estructura bilingüe pública | Academia hoy prioriza español | Catálogo/UI ES/IT sin traducir cursos automáticamente | Bajo | P2/P5 |
| Migraciones | No normalizado | SQL existente sirve de referencia | Dejar `supabase/sql/` como legado/documentación | `supabase/migrations/YYYYMMDDHHMMSS_*.sql` | Alto: drift si continuamos sin migraciones | P0 |

## Decisiones P0

1. El motor canónico de evaluación será `assessments*`. No se crearán motores paralelos.
2. El progreso se almacenará en `lesson_progress`; la última lección puede resolverse por `updated_at` y `progress_seconds` sin inventar otra tabla.
3. Yamilet Academy no será CRM. Las reservas de clase pertenecen a la academia; los leads/comercial pertenecen a Compás One.
4. Todo DDL nuevo se guardará primero como migración en `supabase/migrations/` y después se aplicará al proyecto.
5. No se cargarán módulos/lecciones ficticios para Método MES.
6. `main` debe permanecer funcional; cada bloque seguirá rama `feature/*` → PR → revisión → merge.

## Primer cierre P0

El primer cambio estructural será endurecer la escritura de `lesson_progress` para que un alumno solo pueda crear/actualizar progreso cuando tenga una inscripción activa o completada en el curso correspondiente. Se mantiene el acceso administrativo existente.