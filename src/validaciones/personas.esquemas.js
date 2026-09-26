/**
 * Esquemas de validación para las rutas de personas.
 *
 * Los mensajes se escriben en español porque se devuelven al usuario.
 * z.coerce convierte el texto de la URL en número antes de validarlo:
 * un valor no numérico ("abc") se convierte en NaN y es rechazado.
 */
import { z } from 'zod';
import { config } from '../config/entorno.js';
import { fechaHoyEnZona } from '../utils/edad.js';

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

// -----------------------------------------------------------------------------
// Alta y edición de personas (campos de texto del formulario)
// -----------------------------------------------------------------------------

// Letras de cualquier idioma (incluye tildes y ñ), espacios, apóstrofos, puntos
// y guiones. Rechaza números, símbolos y caracteres de control.
const PATRON_NOMBRE = /^[\p{L}\p{M}' .-]+$/u;

const FECHA_MINIMA = '1900-01-01';

/** Esquema reutilizable para nombres y apellidos. */
function textoDePersona(campo) {
  return z
    .string({ error: `${campo} es obligatorio` })
    .trim()
    .min(1, { error: `${campo} es obligatorio` })
    .max(100, { error: `${campo} admite como máximo 100 caracteres` })
    .regex(PATRON_NOMBRE, { error: `${campo} solo admite letras, espacios, apóstrofos, puntos y guiones` })
    // Unifica espacios repetidos: "Ana   María" -> "Ana María"
    .transform((valor) => valor.replace(/\s+/g, ' '));
}

/**
 * Devuelve el problema de una fecha de nacimiento, o null si es válida.
 * Verifica formato, que exista en el calendario, el límite inferior
 * y que no sea futura (según la fecha de hoy en la zona horaria configurada).
 */
function problemaFechaNacimiento(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return 'La fecha de nacimiento debe tener el formato AAAA-MM-DD';
  }

  // Si la fecha no existe (ej: 2023-02-30), JavaScript la "corre" al día
  // siguiente válido; comparar las partes detecta ese corrimiento.
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    return 'La fecha de nacimiento no existe en el calendario';
  }

  // En formato AAAA-MM-DD, el orden alfabético coincide con el cronológico
  if (valor < FECHA_MINIMA) {
    return 'La fecha de nacimiento no puede ser anterior a 1900';
  }
  if (valor > fechaHoyEnZona(config.zonaHoraria)) {
    return 'La fecha de nacimiento no puede ser futura';
  }

  return null;
}

export const esquemaPersona = z.object({
  nombres: textoDePersona('El nombre'),
  apellidos: textoDePersona('El apellido'),

  // Normalización: quita espacios, puntos y guiones, y pasa a mayúsculas.
  // "1.234.567" y "1234567" se guardan igual, así la restricción UNIQUE
  // de la base detecta el mismo documento escrito de distintas formas.
  nroDocumento: z
    .string({ error: 'El número de documento es obligatorio' })
    .max(40, { error: 'El número de documento es demasiado largo' })
    .transform((valor) => valor.replace(/[\s.-]/g, '').toUpperCase())
    .pipe(
      z.string().regex(/^[0-9A-Z]{3,20}$/, {
        error: 'El número de documento debe tener entre 3 y 20 letras o números',
      }),
    ),

  fechaNacimiento: z
    .string({ error: 'La fecha de nacimiento es obligatoria' })
    .refine((valor) => problemaFechaNacimiento(valor) === null, {
      error: (problema) => problemaFechaNacimiento(problema.input),
    }),
});

// Imagen de una persona: /api/personas/:id/imagenes/:lado
// Reutiliza la validación del id y agrega el lado, restringido a dos valores.
export const esquemaImagen = esquemaId.extend({
  lado: z.enum(['frente', 'dorso'], { error: 'El lado debe ser "frente" o "dorso"' }),
});

// -----------------------------------------------------------------------------
// Búsqueda
// -----------------------------------------------------------------------------

export const LARGO_MINIMO_BUSQUEDA = 3;
export const LARGO_MAXIMO_BUSQUEDA = 100;

export const esquemaBusqueda = z.object({
  termino: z
    // Rechaza contenido no textual (números, listas, objetos)
    .string({ error: 'El término de búsqueda debe ser un texto' })
    .max(LARGO_MAXIMO_BUSQUEDA, {
      error: `El término de búsqueda admite como máximo ${LARGO_MAXIMO_BUSQUEDA} caracteres`,
    })
    // Quita espacios de los extremos y unifica los espacios internos
    .transform((valor) => valor.trim().replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(LARGO_MINIMO_BUSQUEDA, {
          error: `Ingrese al menos ${LARGO_MINIMO_BUSQUEDA} caracteres para buscar`,
        })
        // Caracteres de control (invisibles): no tienen sentido en una búsqueda
        .refine((valor) => !/\p{Cc}/u.test(valor), {
          error: 'El término de búsqueda contiene caracteres no permitidos',
        }),
    ),
});