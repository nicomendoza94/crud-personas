/**
 * Configuración de la aplicación a partir de variables de entorno.
 *
 * Toda lectura de process.env se centraliza en este módulo para:
 *  1. Validar al arrancar que no falte ninguna variable ("fallar rápido"):
 *     es mejor que la app no inicie a que falle en medio de una búsqueda.
 *  2. Convertir tipos: process.env siempre devuelve texto.
 *  3. Que el resto del código importe `config` y nunca lea process.env directamente.
 */
import { z } from 'zod';

// Esquema: qué variables esperamos, de qué tipo y con qué valores por defecto.
// Las variables con datos sensibles o propios de cada instalación (nombre de la base,
// usuario, contraseña, claves) NO tienen valor por defecto: si faltan, la app no arranca.
const esquema = z.object({
  // --- Servidor ---
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  // z.coerce convierte el texto "3000" en el número 3000 antes de validarlo
  PUERTO: z.coerce.number().int().min(1).max(65535).default(3000),

  // Zona horaria usada para calcular "hoy" (edad de las personas, fechas futuras).
  // Se valida que sea una zona IANA real (ej: America/Asuncion).
  ZONA_HORARIA: z
    .string()
    .default('America/Asuncion')
    .refine((zona) => {
      try {
        new Intl.DateTimeFormat('es', { timeZone: zona });
        return true;
      } catch {
        return false;
      }
    }, 'Zona horaria inválida'),

  // --- Captcha (Cloudflare Turnstile) ---
  // Sin valores por defecto: las claves deben configurarse en cada instalación
  TURNSTILE_CLAVE_SITIO: z.string().min(1),
  TURNSTILE_CLAVE_SECRETA: z.string().min(1),
  // Política de la sesión de búsqueda habilitada por un captcha aprobado
  CAPTCHA_VIGENCIA_MINUTOS: z.coerce.number().int().min(1).max(120).default(10),
  CAPTCHA_MAXIMO_BUSQUEDAS: z.coerce.number().int().min(1).max(500).default(20),

  // --- Geolocalización de IP ---
  // Tiempo máximo de espera de la API (ms). Configurable para poder probar el
  // comportamiento ante demoras (ej: 1 ms fuerza un timeout).
  GEOLOCALIZACION_TIEMPO_MAXIMO_MS: z.coerce.number().int().min(1).max(10_000).default(3000),

  // --- Base de datos ---
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PUERTO: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_NOMBRE: z.string().min(1),
  DB_USUARIO: z.string().min(1),
  DB_CONTRASENA: z.string().min(1),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  // Mostramos QUÉ variable falló y por qué, pero nunca su valor:
  // hay contraseñas y tokens que no deben terminar en un log.
  console.error('Configuración inválida en las variables de entorno:');
  for (const problema of resultado.error.issues) {
    console.error(`  - ${problema.path.join('.')}: ${problema.message}`);
  }
  process.exit(1);
}

const variables = resultado.data;

// Object.freeze impide modificar la configuración en ejecución.
// Es "superficial": solo congela el primer nivel, por eso los objetos
// anidados se congelan por separado.
export const config = Object.freeze({
  entorno: variables.NODE_ENV,
  esProduccion: variables.NODE_ENV === 'production',
  host: variables.HOST,
  puerto: variables.PUERTO,
  zonaHoraria: variables.ZONA_HORARIA,

  captcha: Object.freeze({
    claveSitio: variables.TURNSTILE_CLAVE_SITIO,
    claveSecreta: variables.TURNSTILE_CLAVE_SECRETA,
    vigenciaMinutos: variables.CAPTCHA_VIGENCIA_MINUTOS,
    maximoBusquedas: variables.CAPTCHA_MAXIMO_BUSQUEDAS,
  }),

  geolocalizacion: Object.freeze({
    tiempoMaximoMs: variables.GEOLOCALIZACION_TIEMPO_MAXIMO_MS,
  }),

  db: Object.freeze({
    host: variables.DB_HOST,
    puerto: variables.DB_PUERTO,
    nombre: variables.DB_NOMBRE,
    usuario: variables.DB_USUARIO,
    contrasena: variables.DB_CONTRASENA,
  }),
});