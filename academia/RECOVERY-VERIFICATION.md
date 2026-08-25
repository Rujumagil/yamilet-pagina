# Verificación de recuperación — Academia Yamilet

Problema observado el 18-08-2026:

- El correo reciente recibido tenía asunto `Your sign-in link`.
- El enlace contenía `type=magiclink` y redirigía a `/yamilet-pagina/academia/`.
- Ese flujo inicia sesión; no abre el formulario de cambio de contraseña.

Corrección aplicada:

1. `Entrar sin contraseña` queda separado visualmente de `Cambiar mi contraseña`.
2. `Cambiar mi contraseña` usa `resetPasswordForEmail()` con `redirectTo` a `/academia/?recovery=1`.
3. La ruta de recuperación detecta query y hash `type=recovery`.
4. El dashboard queda bloqueado mientras se procesa recuperación.
5. El puente de sesión no recarga la página en una ruta de recuperación.
6. El formulario de nueva contraseña actualiza la contraseña y limpia la URL al terminar.
