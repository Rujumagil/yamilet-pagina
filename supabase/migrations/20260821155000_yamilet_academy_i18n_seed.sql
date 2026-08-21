-- Academia Yamilet v27 · contenido inicial bilingüe de Método MES®

update public.courses
set description='Programa de presencia, expresión segura y liberación.', updated_at=now()
where id='44444444-4444-4444-8444-444444444444';

insert into public.academy_content_translations
(course_id,entity_type,entity_id,locale,field_name,source_text,translated_text,status,created_by,updated_at)
values
('44444444-4444-4444-8444-444444444444','course','44444444-4444-4444-8444-444444444444','it','title','Método MES®','Método MES®','published',null,now()),
('44444444-4444-4444-8444-444444444444','course','44444444-4444-4444-8444-444444444444','it','subtitle','Mindfulness, escritura y serenidad para crear un sistema personal.','Mindfulness, scrittura e serenità per creare un sistema personale.','published',null,now()),
('44444444-4444-4444-8444-444444444444','course','44444444-4444-4444-8444-444444444444','it','description','Programa de presencia, expresión segura y liberación.','Programma di presenza, espressione sicura e liberazione.','published',null,now())
on conflict (entity_type,entity_id,locale,field_name)
do update set
  source_text=excluded.source_text,
  translated_text=excluded.translated_text,
  status=excluded.status,
  updated_at=now();
