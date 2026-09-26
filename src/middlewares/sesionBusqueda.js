/**
 * Exige una sesión de búsqueda vigente (habilitada por un captcha aprobado).
 *
 * Sin cookie válida, o con la sesión vencida o agotada, la búsqueda se
 * rechaza con 403 y el código CAPTCHA_REQUERIDO: el cliente debe resolver
 * el captcha nuevamente. Así, la búsqueda no puede ejecutarse eludiendo la
 * verificación (por ejemplo, llamando a la API desde una terminal).
 */
import { config } from '../config/entorno.js';
import { ErrorAplicacion } from './errores.js';
import * as sesionBusqueda from '../servicios/sesionBusqueda.servicio.js';

export const NOMBRE_COOKIE = 'sesion_busqueda';

/**
 * Opciones de la cookie de sesión.
 *  - httpOnly: el JavaScript de la página no puede leerla (protege ante XSS).
 *  - secure: solo viaja por HTTPS (en producción, detrás del túnel).
 *  - sameSite 'strict': no se envía en peticiones originadas en otros sitios.
 *  - path: solo se envía a las rutas de búsqueda, no al resto de la API.
 */
export function opcionesCookie(duracionMs) {
  return {
    httpOnly: true,
    secure: config.esProduccion,
    sameSite: 'strict',
    path: '/api/busquedas',
    maxAge: duracionMs,
  };
}

export async function exigirSesionBusqueda(req, res, next) {
  // Descuenta una búsqueda en una operación atómica (ver sesiones.repositorio.js)
  const sesion = await sesionBusqueda.consumirBusqueda(req.cookies?.[NOMBRE_COOKIE]);

  if (!sesion) {
    return next(
      new ErrorAplicacion(
        403,
        'Debe completar la verificación antes de buscar.',
        undefined,
        'CAPTCHA_REQUERIDO',
      ),
    );
  }

  // Queda disponible para el controlador (búsquedas restantes y vencimiento)
  res.locals.sesionBusqueda = sesion;
  next();
}