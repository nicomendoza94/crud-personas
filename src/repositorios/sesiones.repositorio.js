/**
 * Repositorio de sesiones de búsqueda (tabla sesiones_busqueda).
 * Solo maneja hashes: el token real nunca llega a la base.
 */
import { pool } from '../db/conexion.js';

/** Crea una sesión con la cantidad de búsquedas y la vigencia indicadas. */
export async function crear(tokenHash, busquedasPermitidas, vigenciaMinutos) {
  await pool.query(
    `INSERT INTO sesiones_busqueda (token_hash, busquedas_restantes, expira_en)
     VALUES ($1, $2, now() + make_interval(mins => $3::int))`,
    [tokenHash, busquedasPermitidas, vigenciaMinutos],
  );
}

/**
 * Descuenta una búsqueda de la sesión, solo si sigue vigente y le quedan búsquedas.
 * Es una única operación atómica: aunque lleguen muchas peticiones simultáneas
 * con la misma sesión, nunca se permiten más búsquedas que las habilitadas.
 *
 * @returns {Promise<{busquedas_restantes: number, expira_en: Date}|null>}
 *          null si la sesión no existe, venció o se agotó
 */
export async function consumirBusqueda(tokenHash) {
  const { rows } = await pool.query(
    `UPDATE sesiones_busqueda
        SET busquedas_restantes = busquedas_restantes - 1
      WHERE token_hash = $1
        AND busquedas_restantes > 0
        AND expira_en > now()
      RETURNING busquedas_restantes, expira_en`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

/** Borra las sesiones vencidas o agotadas (limpieza). */
export async function eliminarInactivas() {
  await pool.query('DELETE FROM sesiones_busqueda WHERE expira_en <= now() OR busquedas_restantes = 0');
}