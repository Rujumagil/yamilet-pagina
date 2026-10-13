# Academia Yamilet — correo de confirmación de registro

## Asunto

`Gracias por inscribirte · confirma tu correo | Academia Yamilet`

## Plantilla HTML para Supabase Auth → Confirm signup

```html
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:32px;color:#173f36;background:#ffffff">
  <div style="text-align:center;margin-bottom:26px">
    <div style="font-size:13px;letter-spacing:.16em;color:#c4973e;font-weight:700">ACADEMIA YAMILET</div>
    <h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.15;margin:10px 0;color:#123f35">Gracias por inscribirte.</h1>
  </div>

  <p style="font-size:16px;line-height:1.7;color:#51645d">
    Hola {{ .Data.full_name }},
  </p>

  <p style="font-size:16px;line-height:1.7;color:#51645d">
    Recibimos tu registro en Academia Yamilet. Antes de ingresar necesitamos confirmar que este correo te pertenece.
  </p>

  <p style="text-align:center;margin:30px 0">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#123f35;color:#ffffff;text-decoration:none;font-weight:700">
      Confirmar mi correo
    </a>
  </p>

  <p style="font-size:14px;line-height:1.7;color:#718078">
    Después de confirmar tu correo te llevaremos a la pantalla de ingreso de Academia Yamilet para que accedas con tu correo y contraseña.
  </p>

  <div style="margin-top:28px;padding:16px;border-radius:12px;background:#f4f7f4;color:#60736b;font-size:13px;line-height:1.6">
    Crear tu cuenta no activa automáticamente un curso de pago. Tus programas aparecerán cuando tu inscripción o compra esté confirmada.
  </div>

  <p style="margin-top:28px;font-size:13px;line-height:1.6;color:#89948f">
    Si tú no realizaste este registro, puedes ignorar este correo.
  </p>

  <p style="margin-top:24px;font-size:14px;color:#123f35">
    Yamilet Pérez<br>
    Academia Yamilet · Método MES®
  </p>
</div>
```

## Flujo esperado

1. La persona entra a `/academia/registro/`.
2. Crea su cuenta.
3. Supabase Auth envía este correo de confirmación.
4. El botón usa `{{ .ConfirmationURL }}`.
5. El registro pasa `emailRedirectTo=https://www.yamiletperez.com/academia/?confirmed=1`.
6. Tras verificar el correo, la persona ve “Correo confirmado”.
7. Toca “Ingresar a mi Academia”.
8. Inicia sesión desde `/academia/`.
