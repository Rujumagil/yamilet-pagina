-- Yamilet Pérez / Academia MES
-- Plantilla de provisión. NO ejecutar sin sustituir el UUID de la administradora real.
-- No contiene IDs de producción ni secretos.

DO $$
DECLARE
  v_admin_user_id uuid := NULL; -- colocar aquí el UUID real de auth.users al momento de entrega
  v_workspace_id uuid;
BEGIN
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Definir v_admin_user_id antes de ejecutar esta plantilla';
  END IF;

  SELECT id INTO v_workspace_id
  FROM public.workspaces
  WHERE slug = 'yamilet-mes'
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (
      name,
      slug,
      description,
      accent_color,
      created_by
    ) VALUES (
      'Academia MES · Yamilet Pérez',
      'yamilet-mes',
      'Workspace independiente para Yamilet Pérez, Método MES y Academia MES.',
      '#425A4A',
      v_admin_user_id
    )
    RETURNING id INTO v_workspace_id;
  END IF;

  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    status
  ) VALUES (
    v_workspace_id,
    v_admin_user_id,
    'admin',
    'active'
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Yamilet workspace_id: %', v_workspace_id;
END $$;

-- Después de provisionar:
-- 1. Configurar YAMILET_WORKSPACE_ID en el entorno de la Edge Function.
-- 2. Crear productos/cursos asociados al workspace_id real mediante el panel de academia.
-- 3. No insertar alumnos manualmente salvo casos de soporte; usar Auth + enrollments/student_access.
-- 4. Ejecutar pruebas de aislamiento RLS antes de publicar.
