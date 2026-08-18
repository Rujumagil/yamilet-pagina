# Academia Yamilet — recuperación de contraseña

La recuperación de contraseña debe usar `supabase.auth.resetPasswordForEmail()` y un `redirectTo` de la propia Academia con `?recovery=1`.

La pantalla debe tratar como recuperación cualquiera de estas señales:

- `?recovery=1`
- `?mode=recovery`
- `#...&type=recovery`
- evento `PASSWORD_RECOVERY`

Mientras existe intención de recuperación, el dashboard y el puente de sesión no deben redirigir ni recargar hacia el login.

El botón de Magic Link se etiqueta como **Entrar sin contraseña** para no confundirlo con la recuperación.
