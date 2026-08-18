# Yamilet Academy — Arquitectura base

## Principio

Yamilet Academy será un LMS privado premium. Academia AG es únicamente referencia funcional. No existe dependencia técnica, de datos o de identidad entre ambas academias.

## Límites del sistema

### Yamilet Academy

Responsable de:
- autenticación académica;
- perfiles académicos;
- cursos, módulos y lecciones;
- inscripciones y progreso;
- evaluaciones;
- recursos/biblioteca;
- certificados;
- eventos académicos;
- soporte académico;
- productos, compras y derecho de acceso a contenido;
- administración académica y auditoría.

### Compás One

Responsable de:
- prospectos y leads;
- conversaciones;
- pipeline comercial;
- campañas;
- automatizaciones comerciales;
- agentes y seguimiento de ventas.

No se compartirán tablas entre bases. La integración futura será servidor-a-servidor por API/eventos.

## Backend

Proyecto Supabase dedicado a la evolución de Yamilet: referencia `pvpgvzaasnkukhoziiyg` (nombre histórico del proyecto: `aula-compas`). Está separado del proyecto de Academia AG y del proyecto Compás One.

Workspace inicial:
- Nombre: `Academia Yamilet`
- Slug: `yamilet-mes`

La arquitectura conserva soporte multi-workspace, pero toda funcionalidad nueva debe estar correctamente acotada al workspace correspondiente.

## Modelo canónico P0

- Identidad: `auth.users` + `profiles`
- Roles globales de perfil: `student`, `instructor`, `admin`
- Gestión por workspace: `workspaces`, `workspace_members`
- Cursos: `courses`
- Módulos: `modules`
- Lecciones: `lessons`
- Inscripciones: `enrollments`
- Progreso: `lesson_progress`
- Evaluaciones: `assessments`, `assessment_questions`, `assessment_options`, `assessment_attempts`, `assessment_answers`
- Biblioteca: `resources`, `resource_access`, `product_contents`
- Certificados: `certificates`
- Productos: `products`
- Compras: `orders`
- Accesos: `student_access`
- Historial: `access_history`
- Notificaciones: `academy_notifications`
- Cola/eventos de integración: `academy_integration_events`
- Agenda clase gratuita: `free_class_bookings`

## Entidades a crear en fases posteriores

- `events`
- `event_registrations`
- `support_tickets` y estructura de respuestas/historial
- `legal_acceptances`

No se crearán antes de la fase correspondiente solo para completar una lista.

## Seguridad

1. RLS permanece obligatorio en toda tabla accesible desde el navegador.
2. El frontend solo usa URL de Supabase y clave publicable.
3. Ningún `service_role`, DB password o JWT secret entra a GitHub/HTML/JS público.
4. Escrituras sensibles deben realizarse mediante políticas estrictas o RPC/Edge Function con autorización explícita.
5. El alumno solo podrá escribir su propio progreso y solo para cursos donde tenga acceso académico válido.
6. Las evaluaciones se calificarán sin exponer `is_correct` al alumno y sin permitirle escribir `score` o `passed` directamente.
7. La administración futura debe validar workspace, no confiar solo en un rol presentado por la UI.

## Experiencia del alumno objetivo

Sidebar:
1. Inicio
2. Mis cursos
3. Evaluaciones
4. Mi biblioteca
5. Calendario
6. Certificados
7. Ayuda y soporte
8. Mi perfil
9. Explorar cursos
10. Administrar (solo permisos administrativos)

La navegación será por vistas/rutas reales. No se utilizará `scrollIntoView` como arquitectura de navegación del panel.

## Experiencia administrativa objetivo

Pestañas reales y persistentes temporalmente:
- Resumen
- Alumnos
- Compras
- Accesos
- Registros
- Academia

La pestaña activa se mantendrá en `sessionStorage` o estado de aplicación equivalente. No se simularán pestañas con desplazamiento vertical.

## Curso

Jerarquía:

`Curso → Módulos → Lecciones → Videos/Materiales → Evaluación de módulo → Finalización → Certificado`

No habrá una evaluación obligatoria después de cada video.

## Videos y recursos privados

La UI nunca mostrará nombres de proveedores, buckets, URLs técnicas o infraestructura. El alumno verá solamente el recurso académico. Los materiales protegidos usarán accesos temporales/firmados cuando corresponda.

## Progreso

`lesson_progress` ya permite almacenar:
- usuario;
- lección;
- completado;
- segundos de reproducción/progreso;
- fecha de finalización;
- última actualización.

La reanudación exacta se resolverá con la fila de progreso más reciente y `progress_seconds`. El porcentaje del curso se calculará sobre lecciones elegibles/completadas.

## Evaluaciones

Se utilizará únicamente el motor `assessments*` existente. Antes de publicar una evaluación real se comprobará:
- lectura segura de preguntas/opciones;
- que `is_correct` no sea visible al alumno;
- que `score`/`passed` solo sean calculados por lógica confiable;
- límites de intentos;
- porcentaje mínimo;
- relación correcta con curso/módulo;
- RLS por alumno y permisos de gestión por workspace.

## CRM e integración

`free_class_bookings` continuará como agenda académica. La lógica que actualmente crea/actualiza `contacts` será retirada en un bloque compatible, sin borrar los contactos ya existentes. En su lugar se emitirá un evento de integración que Compás One podrá consumir en el futuro.

Eventos futuros previstos:
- `student.created`
- `student.updated`
- `enrollment.created`
- `order.approved`
- `access.granted`
- `access.suspended`
- `course.started`
- `course.completed`
- `assessment.passed`
- `certificate.issued`
- `support.created`
- `event.registered`

## Migraciones

A partir de P0:

`supabase/migrations/YYYYMMDDHHMMSS_nombre_descriptivo.sql`

Los archivos de `supabase/sql/` quedan como material legado/documental hasta que su funcionalidad sea absorbida por migraciones reproducibles.