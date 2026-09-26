/**
 * Verificación con Cloudflare Turnstile.
 *
 * El script de Turnstile se descarga solo la primera vez que se necesita.
 * solicitarCaptcha() muestra el widget en un diálogo y, cuando el usuario lo
 * resuelve, envía el token al servidor, que abre una sesión de búsqueda.
 */
import * as api from './api.js';

const URL_SCRIPT_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const el = {
  dialogo: document.getElementById('dialogo-captcha'),
  contenedor: document.getElementById('contenedor-captcha'),
  error: document.getElementById('error-captcha'),
};

// Se guardan para no repetir la descarga ni la consulta de la configuración
let promesaTurnstile = null;
let claveSitio = null;

/** Descarga el script de Turnstile una única vez. */
function cargarTurnstile() {
  promesaTurnstile ??= new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    // render=explicit: el widget se dibuja cuando lo pedimos, no automáticamente
    script.src = URL_SCRIPT_TURNSTILE;
    script.async = true;
    script.onload = () => resolver(window.turnstile);
    script.onerror = () => {
      promesaTurnstile = null; // Permite reintentar más tarde
      rechazar(new Error('No se pudo cargar la verificación. Revise su conexión e intente nuevamente.'));
    };
    document.head.append(script);
  });
  return promesaTurnstile;
}

async function obtenerClaveSitio() {
  if (!claveSitio) {
    const configuracion = await api.obtenerConfiguracion();
    claveSitio = configuracion.captcha.claveSitio;
  }
  return claveSitio;
}

function mostrarError(texto) {
  el.error.textContent = texto;
  el.error.hidden = false;
}

/**
 * Muestra el captcha y espera a que el usuario lo resuelva.
 * @returns {Promise<boolean>} true si se verificó y hay sesión de búsqueda;
 *                             false si el usuario canceló
 * @throws {Error} si no se pudo cargar el widget
 */
export async function solicitarCaptcha() {
  const [turnstile, sitekey] = await Promise.all([cargarTurnstile(), obtenerClaveSitio()]);

  el.error.hidden = true;
  el.dialogo.showModal();

  return new Promise((resolver) => {
    let idWidget = null;
    let terminado = false;

    // Cierra todo y devuelve el resultado una sola vez
    const terminar = (verificado) => {
      if (terminado) return;
      terminado = true;
      el.dialogo.removeEventListener('close', alCerrar);
      if (idWidget !== null) turnstile.remove(idWidget);
      if (el.dialogo.open) el.dialogo.close();
      resolver(verificado);
    };

    // Cancelar (botón o tecla Esc) equivale a no verificar
    const alCerrar = () => terminar(false);
    el.dialogo.addEventListener('close', alCerrar);

    idWidget = turnstile.render(el.contenedor, {
      sitekey,
      language: 'es',
      // El usuario resolvió el widget: se envía el token al servidor
      callback: async (token) => {
        try {
          await api.verificarCaptcha(token);
          terminar(true);
        } catch (err) {
          // Token rechazado (vencido, reutilizado) o servidor no disponible:
          // se reinicia el widget para obtener un token nuevo
          mostrarError(err.message);
          turnstile.reset(idWidget);
        }
      },
      'error-callback': () => {
        mostrarError('Ocurrió un problema con la verificación. Intente nuevamente.');
      },
      // El token vence si el usuario tarda demasiado: se pide uno nuevo
      'expired-callback': () => turnstile.reset(idWidget),
    });
  });
}