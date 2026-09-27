/**
 * Envío de notificaciones a un grupo de Telegram (API de bots).
 *
 * enviarMensaje() NUNCA lanza errores: devuelve { estado: 'enviado' | 'error', detalle },
 * que se registra en la auditoría. Una falla de Telegram no afecta la búsqueda.
 *
 * Seguridad: la URL de la API contiene el token del bot. Por eso los errores
 * nunca se registran con la URL ni con el error original: solo con una
 * descripción propia.
 */
import { config } from '../config/entorno.js';

const URL_API = 'https://api.telegram.org';
const LARGO_MAXIMO_DETALLE = 300; // Largo de la columna telegram_detalle

/** Traduce una respuesta de error de Telegram a un detalle legible. */
function describirError(codigoHttp, datos) {
  const descripcion = typeof datos?.description === 'string' ? datos.description : 'sin descripción';

  if (codigoHttp === 401) {
    return 'Token del bot inválido: revise TELEGRAM_TOKEN_BOT';
  }
  if (datos?.parameters?.migrate_to_chat_id) {
    return `El grupo se convirtió en supergrupo; nuevo TELEGRAM_CHAT_ID: ${datos.parameters.migrate_to_chat_id}`;
  }
  if (codigoHttp === 403) {
    // Ej: el bot fue removido del grupo
    return `El bot no puede escribir en el grupo: ${descripcion}`;
  }
  if (codigoHttp === 429) {
    return `Límite de envíos superado; Telegram pide esperar ${datos?.parameters?.retry_after ?? '?'} s`;
  }
  return `Error ${codigoHttp}: ${descripcion}`;
}

/**
 * Envía un mensaje de texto plano al grupo configurado.
 * @returns {Promise<{ estado: 'enviado'|'error', detalle: string }>}
 */
export async function enviarMensaje(texto) {
  let respuesta;
  let datos;
  try {
    respuesta = await fetch(`${URL_API}/bot${config.telegram.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Sin parse_mode: el texto se muestra literalmente, sin interpretar HTML ni Markdown
      body: JSON.stringify({ chat_id: config.telegram.chatId, text: texto }),
      signal: AbortSignal.timeout(config.telegram.tiempoMaximoMs),
    });
    datos = await respuesta.json();
  } catch (err) {
    // No se registra err: podría incluir datos de la petición (y la URL contiene el token)
    const detalle = err.name === 'TimeoutError'
      ? 'Tiempo de espera agotado'
      : 'No se pudo conectar con Telegram';
    console.error(`Telegram: ${detalle}`);
    return { estado: 'error', detalle };
  }

  // La API responde { ok: true, result } o { ok: false, error_code, description }
  if (datos?.ok === true) {
    return { estado: 'enviado', detalle: `Mensaje ${datos.result?.message_id ?? ''}`.trim() };
  }

  const detalle = describirError(respuesta.status, datos).slice(0, LARGO_MAXIMO_DETALLE);
  console.error(`Telegram: ${detalle}`);
  return { estado: 'error', detalle };
}