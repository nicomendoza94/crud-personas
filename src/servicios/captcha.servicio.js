/**
 * Verificación del captcha deslizante (GeeTest CAPTCHA v4) contra la API de GeeTest.
 *
 * Al resolver el deslizador, el navegador recibe de GeeTest cuatro valores
 * (lot_number, captcha_output, pass_token y gen_time). Solo el servidor puede
 * confirmar que son válidos: los envía a la "validación secundaria" de GeeTest
 * junto con una firma HMAC-SHA256 calculada con la Key privada, que nunca sale
 * del servidor. Valores inventados o reutilizados son rechazados por GeeTest:
 * por eso la verificación no puede eludirse llamando a la API directamente.
 *
 * Ante una falla de GeeTest se FALLA CERRADO (503): sin verificación no hay
 * búsqueda. La documentación de GeeTest sugiere dejar pasar al usuario si su
 * servicio no responde; aquí no se hace, porque el captcha es un control de seguridad.
 */
import crypto from 'node:crypto';
import { config } from '../config/entorno.js';
import { ErrorAplicacion } from '../middlewares/errores.js';

const URL_VALIDACION = 'https://gcaptcha4.geetest.com/validate';

// Toda llamada saliente tiene un tiempo máximo de espera
const TIEMPO_MAXIMO_MS = 5000;

// Los cuatro valores que GeeTest entrega al navegador al resolver el desafío
const CAMPOS_RESULTADO = ['lot_number', 'captcha_output', 'pass_token', 'gen_time'];

// Límite defensivo: evita reenviar a GeeTest textos gigantes enviados a propósito
const LARGO_MAXIMO_CAMPO = 2048;

const ERROR_SERVICIO = new ErrorAplicacion(
  503,
  'No se pudo completar la verificación en este momento. Intente nuevamente en unos instantes.',
);

/**
 * Firma exigida por GeeTest: HMAC-SHA256 del lot_number, usando la Key privada.
 * GeeTest calcula la misma firma y compara: así la Key nunca viaja por la red.
 */
export function calcularFirma(lotNumber, clavePrivada) {
  return crypto.createHmac('sha256', clavePrivada).update(lotNumber).digest('hex');
}

/**
 * Verifica con GeeTest el resultado del captcha enviado por el navegador.
 *
 * @param {object} resultado { lot_number, captcha_output, pass_token, gen_time }
 * @throws {ErrorAplicacion} 400 si faltan valores o tienen un formato imposible,
 *                           403 si GeeTest los rechaza,
 *                           503 si no se pudo consultar a GeeTest
 */
export async function verificarCaptcha(resultado) {
  // 1. Forma: los cuatro valores, como textos de largo razonable
  const datos = {};
  for (const campo of CAMPOS_RESULTADO) {
    const valor = resultado?.[campo];
    if (typeof valor !== 'string' || valor.length === 0 || valor.length > LARGO_MAXIMO_CAMPO) {
      throw new ErrorAplicacion(400, 'Debe completar la verificación antes de buscar.');
    }
    datos[campo] = valor;
  }

  // 2. Validación secundaria con GeeTest
  let respuestaGeetest;
  try {
    const url = `${URL_VALIDACION}?captcha_id=${encodeURIComponent(config.captcha.captchaId)}`;
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...datos,
        sign_token: calcularFirma(datos.lot_number, config.captcha.captchaKey),
      }),
      // Corta la espera si GeeTest no responde a tiempo
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });

    if (!respuesta.ok) {
      console.error(`GeeTest respondió con el código HTTP ${respuesta.status}`);
      throw ERROR_SERVICIO;
    }
    respuestaGeetest = await respuesta.json();
  } catch (err) {
    if (err === ERROR_SERVICIO) throw err;
    const motivo = err.name === 'TimeoutError' ? 'tiempo de espera agotado' : err.message;
    console.error(`No se pudo contactar a GeeTest: ${motivo}`);
    throw ERROR_SERVICIO;
  }

  // 3. Interpretar la respuesta.
  // status distinto de "success": GeeTest no pudo procesar la consulta
  // (por ejemplo, un captcha_id mal configurado). Es un error NUESTRO, no del usuario.
  if (respuestaGeetest?.status !== 'success') {
    console.error(`GeeTest no procesó la validación: ${JSON.stringify(respuestaGeetest)}`);
    throw ERROR_SERVICIO;
  }

  if (respuestaGeetest.result === 'success') {
    return;
  }

  // result "fail": valores inventados, vencidos o ya utilizados
  throw new ErrorAplicacion(403, 'La verificación no es válida o ya fue utilizada. Complétela nuevamente.');
}