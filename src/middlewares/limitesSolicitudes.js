/**
 * Límites de frecuencia de solicitudes por IP (rate limiting).
 *
 * La IP es la del visitante real (res.locals.ipCliente, ver utils/ip.js):
 * detrás del túnel, usar la IP de la conexión haría que todos los visitantes
 * compartieran el mismo contador.
 *
 * Los contadores se guardan en memoria: suficiente para un único servidor.
 */
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { ErrorAplicacion } from './errores.js';

const UN_MINUTO_MS = 60 * 1000;

/**
 * Crea un limitador con las opciones comunes.
 * @param {number} maximo   Solicitudes permitidas por IP en la ventana de tiempo
 * @param {string} mensaje  Mensaje para el usuario al superar el límite
 * @param {object} [opciones] Opciones adicionales de express-rate-limit
 */
function crearLimitador(maximo, mensaje, opciones = {}) {
  return rateLimit({
    windowMs: UN_MINUTO_MS,
    limit: maximo,

    // Clave de cada contador: la IP real del visitante. ipKeyGenerator agrupa
    // las IPv6 por bloque (/56): un mismo usuario dispone de muchas direcciones
    // IPv6 y podría rotarlas para evadir el límite.
    keyGenerator: (req, res) => ipKeyGenerator(res.locals.ipCliente.ip),

    // Encabezados estándar RateLimit-* (y no los antiguos X-RateLimit-*)
    standardHeaders: 'draft-8',
    legacyHeaders: false,

    // La librería advierte si recibe X-Forwarded-For sin "trust proxy" configurado.
    // Es intencional: la IP se obtiene de CF-Connecting-IP y X-Forwarded-For se
    // ignora a propósito (el cliente puede falsificarlo).
    validate: { xForwardedForHeader: false },

    // Se responde con el mismo formato de error que el resto de la API
    handler: (req, res, next) => {
      next(new ErrorAplicacion(429, mensaje, undefined, 'LIMITE_SOLICITUDES'));
    },
    ...opciones,
  });
}

/** Toda la API: holgado para el uso normal (listado, detalle, imágenes). */
export const limiteGeneral = crearLimitador(
  120,
  'Demasiadas solicitudes. Espere un momento e intente nuevamente.',
);

/**
 * Verificación del captcha y búsquedas: cada búsqueda consulta la API de
 * geolocalización y envía un mensaje a Telegram (que admite unos 20 mensajes
 * por minuto por grupo).
 */
export const limiteBusquedas = crearLimitador(
  20,
  'Se alcanzó el límite de búsquedas por minuto. Espere un momento e intente nuevamente.',
);

/** Alta, edición y baja: el procesamiento de imágenes consume CPU. */
export const limiteEscrituras = crearLimitador(
  20,
  'Se alcanzó el límite de modificaciones por minuto. Espere un momento e intente nuevamente.',
);

/**
 * Intentos FALLIDOS del captcha deslizante: 5 cada 15 minutos por IP.
 * Las verificaciones exitosas no cuentan (skipSuccessfulRequests): un usuario
 * normal nunca alcanza el límite, pero un programa que adivina la posición al
 * azar (cada intento acierta cerca del 7% de las veces) queda frenado.
 */
export const limiteIntentosCaptcha = crearLimitador(
  5,
  'Demasiados intentos fallidos de verificación. Espere unos minutos e intente nuevamente.',
  { windowMs: 15 * UN_MINUTO_MS, skipSuccessfulRequests: true },
);