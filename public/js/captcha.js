/**
 * Verificación con el captcha deslizante de GeeTest (CAPTCHA v4).
 *
 * El script de GeeTest se descarga solo la primera vez que se necesita. Se usa
 * el modo "bind": no hay un botón fijo en la página; cuando el servidor exige
 * verificación, solicitarCaptcha() abre la ventana del deslizador. Al
 * resolverlo, GeeTest entrega cuatro valores que se envían al servidor, que los
 * valida con GeeTest y abre una sesión de búsqueda.
 */
import * as api from './api.js';

const URL_SCRIPT_GEETEST = 'https://static.geetest.com/v4/gt4.js';

// Se guardan para crear el captcha una sola vez
let promesaCaptcha = null;

// La solicitud en curso: el captcha es uno solo, y atiende un pedido por vez
let pendiente = null;

/** Descarga el script de GeeTest (define la función global initGeetest4). */
function cargarScript() {
  return new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = URL_SCRIPT_GEETEST;
    script.async = true;
    script.onload = () => resolver(window.initGeetest4);
    script.onerror = () =>
      rechazar(new Error('No se pudo cargar la verificación. Revise su conexión e intente nuevamente.'));
    document.head.append(script);
  });
}

/** Termina la solicitud en curso, una sola vez. */
function terminar(verificado, error) {
  if (!pendiente) return;
  const { resolver, rechazar } = pendiente;
  pendiente = null;
  if (error) rechazar(error);
  else resolver(verificado);
}

/**
 * Crea el captcha una única vez: descarga el script, pide el ID público al
 * servidor y registra qué hacer cuando el usuario lo resuelve o lo cierra.
 */
function obtenerCaptcha() {
  promesaCaptcha ??= (async () => {
    const [initGeetest4, configuracion] = await Promise.all([cargarScript(), api.obtenerConfiguracion()]);

    return new Promise((resolver, rechazar) => {
      initGeetest4(
        {
          captchaId: configuracion.captcha.captchaId,
          product: 'bind', // sin botón fijo: se abre al llamar a showCaptcha()
          language: 'spa',
        },
        (captcha) => {
          captcha
            .onReady(() => resolver(captcha))
            // El usuario resolvió el deslizador: el servidor valida el resultado con GeeTest
            .onSuccess(async () => {
              const resultado = captcha.getValidate();
              try {
                await api.verificarCaptcha(resultado);
                terminar(true);
              } catch (err) {
                // Rechazado (vencido, reutilizado) o servidor no disponible
                terminar(false, err);
              } finally {
                // Deja el captcha listo para la próxima vez que se necesite
                captcha.reset();
              }
            })
            // El usuario cerró la ventana sin resolver: equivale a cancelar
            .onClose(() => terminar(false))
            .onError((error) => {
              console.error('Error de GeeTest:', error);
              terminar(false, new Error('Ocurrió un problema con la verificación. Intente nuevamente.'));
            });
        },
      );
    });
  })().catch((err) => {
    promesaCaptcha = null; // Permite reintentar más tarde
    throw err;
  });

  return promesaCaptcha;
}

/**
 * Muestra el captcha deslizante y espera a que el usuario lo resuelva.
 * @returns {Promise<boolean>} true si se verificó y hay sesión de búsqueda;
 *                             false si el usuario cerró la ventana
 * @throws {Error} si no se pudo cargar o el servidor rechazó la verificación
 */
export async function solicitarCaptcha() {
  const captcha = await obtenerCaptcha();
  return new Promise((resolver, rechazar) => {
    pendiente = { resolver, rechazar };
    captcha.showCaptcha();
  });
}