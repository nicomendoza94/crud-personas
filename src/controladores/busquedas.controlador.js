/**
 * Controlador de búsquedas: capa HTTP.
 *
 * La búsqueda se recibe por POST con el término en el cuerpo (JSON) y no en
 * la URL: el término puede ser un dato personal, y las URLs quedan registradas
 * en historiales y logs de servidores e intermediarios.
 */
import * as personasServicio from '../servicios/personas.servicio.js';
import * as captchaServicio from '../servicios/captcha.servicio.js';
import * as sesionBusqueda from '../servicios/sesionBusqueda.servicio.js';
import { validar } from '../validaciones/validar.js';
import { esquemaBusqueda } from '../validaciones/personas.esquemas.js';
import { NOMBRE_COOKIE, opcionesCookie } from '../middlewares/sesionBusqueda.js';

/**
 * POST /api/busquedas/verificacion  { "token": "<token de Turnstile>" }
 * Verifica el captcha y, si es válido, abre una sesión de búsqueda (cookie).
 */
export async function verificarCaptcha(req, res) {
  await captchaServicio.verificarTokenCaptcha(req.body?.token);

  const sesion = await sesionBusqueda.iniciar();
  res.cookie(NOMBRE_COOKIE, sesion.token, opcionesCookie(sesion.vigenciaMinutos * 60_000));

  // El token de sesión viaja solo en la cookie, nunca en el cuerpo de la respuesta
  res.status(201).json({
    busquedasPermitidas: sesion.busquedasPermitidas,
    vigenciaMinutos: sesion.vigenciaMinutos,
  });
}

/**
 * POST /api/busquedas  { "termino": "..." }
 * Requiere una sesión de búsqueda vigente (middleware exigirSesionBusqueda).
 */
export async function buscar(req, res) {
  const { termino } = validar(esquemaBusqueda, req.body ?? {});
  const resultado = await personasServicio.buscar(termino);

  res.json({
    ...resultado,
    // Informa al cliente cuánto le queda de la sesión actual
    sesion: res.locals.sesionBusqueda,
  });
}