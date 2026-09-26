/**
 * Verificación del captcha (Cloudflare Turnstile) contra la API de Cloudflare.
 *
 * El navegador obtiene un token al resolver el widget, pero solo el servidor
 * puede validarlo (con la clave secreta). Un token inventado o reutilizado es
 * rechazado por Cloudflare: por eso la verificación no puede eludirse llamando
 * a la API directamente.
 *
 * Ante una falla de Cloudflare se FALLA CERRADO: sin verificación no hay
 * búsqueda, porque el captcha es un control de seguridad.
 */
import { config } from '../config/entorno.js';
import { ErrorAplicacion } from '../middlewares/errores.js';

const URL_VERIFICACION = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Toda llamada saliente tiene un tiempo máximo de espera
const TIEMPO_MAXIMO_MS = 5000;

// Largo máximo documentado para un token de Turnstile
const LARGO_MAXIMO_TOKEN = 2048;

const ERROR_SERVICIO = new ErrorAplicacion(
  503,
  'No se pudo completar la verificación en este momento. Intente nuevamente en unos instantes.',
);

/**
 * Verifica un token de Turnstile con la API de Cloudflare.
 *
 * @param {string} token       Token entregado por el widget al navegador
 * @param {string} [ipVisitante] IP del visitante (opcional, mejora la verificación)
 * @throws {ErrorAplicacion} 400 si el token falta o tiene un formato imposible,
 *                           403 si Cloudflare lo rechaza,
 *                           503 si no se pudo consultar a Cloudflare
 */
export async function verificarTokenCaptcha(token, ipVisitante) {
  if (typeof token !== 'string' || token.length === 0 || token.length > LARGO_MAXIMO_TOKEN) {
    throw new ErrorAplicacion(400, 'Debe completar la verificación antes de buscar.');
  }

  let resultado;
  try {
    const respuesta = await fetch(URL_VERIFICACION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: config.captcha.claveSecreta,
        response: token,
        ...(ipVisitante ? { remoteip: ipVisitante } : {}),
      }),
      // Corta la espera si Cloudflare no responde a tiempo
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });

    if (!respuesta.ok) {
      console.error(`Turnstile respondió con el código HTTP ${respuesta.status}`);
      throw ERROR_SERVICIO;
    }
    resultado = await respuesta.json();
  } catch (err) {
    if (err === ERROR_SERVICIO) throw err;
    const motivo = err.name === 'TimeoutError' ? 'tiempo de espera agotado' : err.message;
    console.error(`No se pudo contactar a Turnstile: ${motivo}`);
    throw ERROR_SERVICIO;
  }

  if (resultado.success === true) {
    return;
  }

  // Cloudflare indica el motivo del rechazo en "error-codes"
  const codigos = resultado['error-codes'] ?? [];

  // Errores de NUESTRA configuración: no son culpa del usuario
  if (codigos.includes('missing-input-secret') || codigos.includes('invalid-input-secret')) {
    console.error('La clave secreta de Turnstile no es válida: revise TURNSTILE_CLAVE_SECRETA');
    throw ERROR_SERVICIO;
  }

  if (codigos.includes('timeout-or-duplicate')) {
    throw new ErrorAplicacion(403, 'La verificación venció o ya fue utilizada. Complétela nuevamente.');
  }

  throw new ErrorAplicacion(403, 'La verificación no es válida. Complétela nuevamente.');
}