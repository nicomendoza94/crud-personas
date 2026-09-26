/**
 * Sesiones de búsqueda: un captcha aprobado habilita una cantidad limitada de
 * búsquedas durante un tiempo limitado (política configurable en .env).
 *
 * El token de sesión es aleatorio (32 bytes) y viaja al navegador en una cookie.
 * En la base solo se guarda su hash SHA-256.
 */
import crypto from 'node:crypto';
import { config } from '../config/entorno.js';
import * as repositorio from '../repositorios/sesiones.repositorio.js';

// 32 bytes en base64url = exactamente 43 caracteres de este alfabeto
const PATRON_TOKEN = /^[A-Za-z0-9_-]{43}$/;

function calcularHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Crea una sesión nueva (se llama después de verificar el captcha).
 * @returns {Promise<{token: string, busquedasPermitidas: number, vigenciaMinutos: number}>}
 */
export async function iniciar() {
  // Limpieza de sesiones que ya no sirven, para que la tabla no crezca indefinidamente
  await repositorio.eliminarInactivas();

  const token = crypto.randomBytes(32).toString('base64url');
  const { maximoBusquedas, vigenciaMinutos } = config.captcha;
  await repositorio.crear(calcularHash(token), maximoBusquedas, vigenciaMinutos);

  return { token, busquedasPermitidas: maximoBusquedas, vigenciaMinutos };
}

/**
 * Descuenta una búsqueda de la sesión indicada.
 * @returns {Promise<{busquedasRestantes: number, expiraEn: Date}|null>}
 *          null si el token no es válido, la sesión venció o se agotó
 */
export async function consumirBusqueda(token) {
  // Un token con formato imposible se descarta sin consultar la base
  if (typeof token !== 'string' || !PATRON_TOKEN.test(token)) {
    return null;
  }

  const sesion = await repositorio.consumirBusqueda(calcularHash(token));
  return sesion
    ? { busquedasRestantes: sesion.busquedas_restantes, expiraEn: sesion.expira_en }
    : null;
}