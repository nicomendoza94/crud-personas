/**
 * Esquemas de validación para las rutas de personas.
 *
 * Los mensajes se escriben en español porque se devuelven al usuario.
 * z.coerce convierte el texto de la URL en número antes de validarlo:
 * un valor no numérico ("abc") se convierte en NaN y es rechazado.
 */
import { z } from 'zod';

// Id de persona en la ruta: /api/personas/:id
export const esquemaId = z.object({
  id: z.coerce
    .number({ error: 'El id debe ser un número' })
    .int({ error: 'El id debe ser un número entero' })
    .positive({ error: 'El id debe ser mayor a cero' })
    .max(Number.MAX_SAFE_INTEGER, { error: 'El id es demasiado grande' }),
});

// Parámetros del listado: /api/personas?pagina=N
export const esquemaListado = z.object({
  pagina: z.coerce
    .number({ error: 'La página debe ser un número' })
    .int({ error: 'La página debe ser un número entero' })
    .min(1, { error: 'La página mínima es 1' })
    .max(100_000, { error: 'La página es demasiado grande' })
    .default(1),
});